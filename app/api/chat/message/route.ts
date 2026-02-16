import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MultiAgentOrchestrator } from '@/lib/services/search/multi-agent-orchestrator';
import { z } from 'zod';

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
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    console.log('Chat message request body:', JSON.stringify(body, null, 2));

    // Validate request body
    const validationResult = ChatMessageSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.errors);
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { conversationId, message, vehicleContext } = validationResult.data;

    // Find or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.chatConversation.findFirst({
        where: {
          id: conversationId,
          userId: session.user.id,
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
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

    // Determine if this is a parts search query
    const isSearchQuery = await isPartsSearchQuery(message);
    console.log('[Chat API] Is search query?', isSearchQuery, 'for message:', message);

    if (isSearchQuery) {
      console.log('[Chat API] Executing multi-agent search...');

      // Check if vehicle is ready for search
      const vehicleId = vehicleContext?.id || vehicleContext?.vehicleId;
      let webSearchOnly = false;
      if (vehicleId) {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id: vehicleId },
          select: { searchConfigStatus: true, make: true, model: true, year: true },
        });

        if (vehicle?.searchConfigStatus !== 'SEARCH_READY') {
          // Vehicle not configured — fall back to web search only
          console.log('[Chat API] Vehicle not SEARCH_READY, falling back to web search only');
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
        console.error('Search error:', searchError);

        // Save error message
        const errorMessage = await prisma.chatMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: `I encountered an error while searching for parts: ${searchError.message}. Please try again or rephrase your query.`,
            messageType: 'TEXT',
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
      // Handle general conversation (non-search)
      // For now, return a simple response
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content:
            "I'm here to help you find parts! Try asking me about specific part numbers or describing what you need.",
          messageType: 'TEXT',
        },
      });

      return NextResponse.json({
        conversationId: conversation.id,
        userMessage,
        assistantMessage,
      });
    }
  } catch (error: any) {
    console.error('Chat message API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to process message',
      },
      { status: 500 }
    );
  }
}

/**
 * Determine if a message is a parts search query
 * Simplified: All messages are treated as search queries by default
 * This is a parts search AI, so we should search for everything
 */
async function isPartsSearchQuery(message: string): Promise<boolean> {
  console.log('[isPartsSearchQuery] Message:', message);
  console.log('[isPartsSearchQuery] Treating all messages as search queries');

  // All messages are search queries in a parts search AI
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Get conversation
    const conversation = await prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Get messages
    const messages = await prisma.chatMessage.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        pickListItems: true,
      },
    });

    return NextResponse.json({
      conversation,
      messages,
    });
  } catch (error: any) {
    console.error('Get messages API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get messages',
      },
      { status: 500 }
    );
  }
}
