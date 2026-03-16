import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-utils';
import { MultiAgentOrchestrator } from '@/lib/services/search/multi-agent-orchestrator';
import { QueryUnderstandingAgent } from '@/lib/services/search/query-understanding';
import { WebSearchAgent } from '@/lib/services/search/web-search-agent';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { PROMPTS } from '@/lib/services/llm/prompt-templates';
import { z } from 'zod';
import { createRequestLogger } from '@/lib/logger';
import { checkOrigin } from '@/lib/csrf';
import { checkRateLimit, rateLimits } from '@/lib/rate-limit';
import { getTierLimits } from '@/lib/subscription-limits';

const ChatMessageSchema = z.object({
  conversationId: z.string().nullable().optional(),
  message: z.string().min(1, 'Message is required'),
  vehicleContext: z
    .object({
      id: z.string().optional(),
      make: z.string(),
      model: z.string(),
      year: z.number(),
      vehicleId: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  const log = createRequestLogger('chat');
  try {
    const originError = checkOrigin(req);
    if (originError) return originError;

    const session = await getServerSession();

    if (!session?.user) {
      return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const rateCheck = await checkRateLimit(`chat:${session.user.id}`, rateLimits.chat);
    if (!rateCheck.success) return rateCheck.response;

    // Check daily message limit for trial/tier-limited orgs
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { subscriptionStatus: true, subscriptionTier: true },
    });

    if (org) {
      const tierLimits = getTierLimits(org.subscriptionTier, org.subscriptionStatus);
      if (tierLimits.maxChatMessagesPerDay !== Infinity) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayMessageCount = await prisma.chatMessage.count({
          where: {
            conversation: { organizationId: session.user.organizationId },
            role: 'USER',
            createdAt: { gte: todayStart },
          },
        });

        if (todayMessageCount >= tierLimits.maxChatMessagesPerDay) {
          return apiError(
            `You've reached your daily limit of ${tierLimits.maxChatMessagesPerDay} messages. Upgrade your plan for unlimited messaging.`,
            403,
            { code: 'DAILY_LIMIT_REACHED', details: { limit: tierLimits.maxChatMessagesPerDay, used: todayMessageCount } }
          );
        }
      }
    }

    const body = await req.json();

    log.debug({ body }, 'Chat message request');

    // Validate request body
    const validationResult = ChatMessageSchema.safeParse(body);
    if (!validationResult.success) {
      log.warn({ errors: validationResult.error.errors }, 'Validation failed');
      return apiError('Invalid request', 400, {
        code: 'VALIDATION_ERROR',
        details: validationResult.error.errors,
      });
    }

    const { conversationId, message, vehicleContext } = validationResult.data;

    // Find or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.chatConversation.findFirst({
        where: {
          id: conversationId,
          userId: session.user.id,
          organizationId: session.user.organizationId,
        },
      });

      if (!conversation) {
        return apiError('Conversation not found', 404, { code: 'NOT_FOUND' });
      }
    } else {
      // Create new conversation
      conversation = await prisma.chatConversation.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          vehicleId: vehicleContext?.id || vehicleContext?.vehicleId || null, // Save vehicle context
          title: message.substring(0, 100), // Use first 100 chars as title
          isActive: true,
        },
      });
    }

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: message,
        messageType: 'TEXT',
      },
    });

    // Increment message count for user message
    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });

    // Determine query intent using fast regex analysis (no LLM call)
    const quickIntent = QueryUnderstandingAgent.regexFallback(message);
    const isTroubleshooting = quickIntent.intent === 'troubleshooting' || quickIntent.intent === 'general_question';
    log.info({ intent: quickIntent.intent, isTroubleshooting, message }, 'Query intent classified');

    if (!isTroubleshooting) {
      log.info('Executing multi-agent search');

      // Check if vehicle is ready for search
      const vehicleId = vehicleContext?.id || vehicleContext?.vehicleId;
      let webSearchOnly = false;
      if (vehicleId) {
        const vehicle = await prisma.vehicle.findFirst({
          where: { id: vehicleId, organizationId: session.user.organizationId },
          select: { searchConfigStatus: true, make: true, model: true, year: true },
        });

        if (vehicle?.searchConfigStatus !== 'SEARCH_READY') {
          // Vehicle not configured — fall back to web search only
          log.info({ vehicleId }, 'Vehicle not SEARCH_READY, falling back to web search only');
          webSearchOnly = true;
        }
      }

      // Execute multi-agent search with formatting
      const orchestrator = new MultiAgentOrchestrator();

      try {
        // Build vehicle context with vehicleId for search mapping lookup
        const searchVehicleContext = vehicleContext ? {
          make: vehicleContext.make,
          model: vehicleContext.model,
          year: vehicleContext.year,
          vehicleId: vehicleId,
        } : undefined;

        const searchResults = await orchestrator.searchWithFormatting(
          message,
          session.user.organizationId,
          searchVehicleContext,
          { webSearchOnly }
        );

        // Save assistant response with formatted results
        const assistantMessage = await prisma.chatMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: searchResults.messageText,
            messageType: 'PART_RECOMMENDATION',
            metadata: JSON.parse(JSON.stringify({
              formattedResponse: searchResults,
              searchMetadata: searchResults.metadata,
            })),
          },
        });

        // Increment message count for assistant message
        await prisma.chatConversation.update({
          where: { id: conversation.id },
          data: {
            messageCount: { increment: 1 },
            lastMessageAt: new Date(),
          },
        });

        // Create or get pick list for this conversation
        let pickList = await prisma.chatPickList.findFirst({
          where: {
            conversationId: conversation.id,
            status: 'ACTIVE',
          },
        });

        if (!pickList) {
          pickList = await prisma.chatPickList.create({
            data: {
              conversationId: conversation.id,
              name: `Parts for ${conversation.title}`,
              status: 'ACTIVE',
            },
          });
        }

        // Create pick list items for top matches (if applicable)
        const topParts = searchResults.parts.slice(0, 5);
        for (const part of topParts) {
          await prisma.chatPickListItem.create({
            data: {
              pickListId: pickList.id,
              messageId: assistantMessage.id,
              partNumber: part.partNumber,
              description: part.description,
              quantity: 1,
              estimatedPrice: part.price,
              notes: `Confidence: ${part.confidenceLabel} (${part.confidence}%)`,
            },
          });
        }

        // Fire-and-forget search analytics write
        prisma.searchLog.create({
          data: {
            organizationId: session.user.organizationId,
            userId: session.user.id,
            query: message,
            intent: searchResults.metadata?.queryIntent,
            searchTimeMs: Math.round(searchResults.metadata?.searchTime || 0),
            totalResults: searchResults.metadata?.totalResults || 0,
            sourcesUsed: searchResults.metadata?.sourcesUsed || [],
            cacheHit: !!searchResults.metadata?.cacheHit,
            spellingCorrected: !!searchResults.metadata?.spellingCorrection,
            isMultiPart: !!searchResults.metadata?.isMultiPartQuery,
            partCount: searchResults.metadata?.partCount || 1,
            vehicleId: vehicleId || null,
          },
        }).catch(() => {}); // Never block the response

        return NextResponse.json({
          conversationId: conversation.id,
          userMessage,
          assistantMessage: {
            ...assistantMessage,
            formattedResponse: searchResults,
          },
          searchResults,
        });
      } catch (searchError: any) {
        log.error({ err: searchError }, 'Search error');

        // Save error message
        const errorMessage = await prisma.chatMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: `I encountered an error while searching for parts: ${searchError.message}. Please try again or rephrase your query.`,
            messageType: 'TEXT',
          },
        });

        // Increment message count for error message
        await prisma.chatConversation.update({
          where: { id: conversation.id },
          data: {
            messageCount: { increment: 1 },
            lastMessageAt: new Date(),
          },
        });

        return NextResponse.json({
          conversationId: conversation.id,
          userMessage,
          assistantMessage: errorMessage,
          error: searchError.message,
        });
      }
    } else {
      // Handle diagnostic/troubleshooting questions via web search + LLM
      log.info({ intent: quickIntent.intent }, 'Routing to technical assistant');

      try {
        const llmClient = await OpenRouterClient.fromOrganization(session.user.organizationId);

        // Search the web for troubleshooting info
        const searchVehicleCtx = vehicleContext ? {
          make: vehicleContext.make,
          model: vehicleContext.model,
          year: vehicleContext.year,
        } : undefined;

        let webContext = '';
        let webSources: { title: string; snippet: string; link: string }[] = [];
        const webSearchAgent = await WebSearchAgent.fromOrganization(session.user.organizationId);
        if (webSearchAgent) {
          webSources = await webSearchAgent.searchDiagnostic(message, searchVehicleCtx);
          webContext = webSources.map(s => `- ${s.title}: ${s.snippet}`).join('\n');
        }

        // Build vehicle context string
        const vehicleStr = vehicleContext
          ? `${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}`
          : '';

        // Fetch recent conversation history for context
        const recentMessages = await prisma.chatMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { role: true, content: true },
        });

        // Build chat messages (system + history + current)
        const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: PROMPTS.TECHNICAL_ASSISTANT(vehicleStr, webContext) },
        ];

        // Add history in chronological order (reverse the desc-ordered results)
        for (const msg of recentMessages.reverse()) {
          if (msg.role === 'USER') {
            chatMessages.push({ role: 'user', content: msg.content });
          } else if (msg.role === 'ASSISTANT') {
            chatMessages.push({ role: 'assistant', content: msg.content });
          }
        }

        // The current user message is already in the history (we saved it above),
        // but add it explicitly if it wasn't included in the recent fetch
        const lastChatMsg = chatMessages[chatMessages.length - 1];
        if (lastChatMsg?.role !== 'user' || lastChatMsg?.content !== message) {
          chatMessages.push({ role: 'user', content: message });
        }

        const llmResponse = await llmClient.chat(chatMessages, {
          temperature: 0.7,
          maxTokens: 1500,
        });

        // Extract suggested parts from the response
        const suggestedSearches = extractSuggestedParts(llmResponse);

        // Save assistant message
        const assistantMessage = await prisma.chatMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: llmResponse,
            messageType: 'TEXT',
            metadata: JSON.parse(JSON.stringify({
              intent: quickIntent.intent,
              suggestedSearches,
              webSources: webSources.map(s => ({ title: s.title, link: s.link })),
            })),
          },
        });

        // Increment message count for assistant message
        await prisma.chatConversation.update({
          where: { id: conversation.id },
          data: {
            messageCount: { increment: 1 },
            lastMessageAt: new Date(),
          },
        });

        return NextResponse.json({
          conversationId: conversation.id,
          userMessage,
          assistantMessage,
        });
      } catch (techError: any) {
        log.error({ err: techError }, 'Technical assistant error');

        // Fallback: save a helpful static message
        const assistantMessage = await prisma.chatMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: "I wasn't able to process your question right now. You can try rephrasing it, or ask me to search for specific parts instead.",
            messageType: 'TEXT',
          },
        });

        await prisma.chatConversation.update({
          where: { id: conversation.id },
          data: {
            messageCount: { increment: 1 },
            lastMessageAt: new Date(),
          },
        });

        return NextResponse.json({
          conversationId: conversation.id,
          userMessage,
          assistantMessage,
        });
      }
    }
  } catch (error: any) {
    log.error({ err: error }, 'Chat message API error');

    return apiError('Failed to process message', 500, { code: 'INTERNAL_ERROR' });
  }
}

/**
 * Extract suggested part names from a technical assistant response.
 * Looks for a "Parts that may need attention:" section and extracts bullet items.
 */
function extractSuggestedParts(response: string): string[] {
  const parts: string[] = [];

  // Look for "Parts that may need attention:" section
  const partsSection = response.match(/parts that may need (?:attention|inspection|replacement):?\s*\n([\s\S]*?)(?:\n\n|\n(?=[A-Z])|\Z)/i);
  if (partsSection) {
    const lines = partsSection[1].split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^[\s\-*•]+/, '').trim();
      if (cleaned && cleaned.length > 2 && cleaned.length < 60) {
        parts.push(cleaned);
      }
    }
  }

  return parts.slice(0, 8); // Cap at 8 suggestions
}

export async function GET(req: NextRequest) {
  const log = createRequestLogger('chat');
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return apiError('Conversation ID is required', 400, { code: 'MISSING_PARAM' });
    }

    // Get conversation
    const conversation = await prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
    });

    if (!conversation) {
      return apiError('Conversation not found', 404, { code: 'NOT_FOUND' });
    }

    // Get messages with pagination (default 100 for chat, covers typical conversations)
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    const msgWhere = { conversationId };

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: msgWhere,
        orderBy: {
          createdAt: 'asc',
        },
        include: {
          pickListItems: true,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chatMessage.count({ where: msgWhere }),
    ]);

    return NextResponse.json({
      conversation,
      messages,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    log.error({ err: error }, 'Get messages API error');

    return apiError('Failed to get messages', 500, { code: 'INTERNAL_ERROR' });
  }
}
