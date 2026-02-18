import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { QUEUE_NAMES } from '@/lib/queue/queues';
import { VoipCallInitiationJobData } from '@/lib/queue/types';
import { workerLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { CallStatus } from '@prisma/client';
import { trackOverageUsage } from '@/lib/billing/overage-billing';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';
import { initializeCallState } from '@/lib/voip/call-graph';
import { saveCallState } from '@/lib/voip/state-manager';
import { addMessage } from '@/lib/voip/helpers';

interface VapiCredentials {
  apiKey: string;
  phoneNumberId: string;
  assistantId?: string; // Optional: Pre-configured VAPI assistant ID
}

const logger = workerLogger.child({ worker: 'voip-call-initiation' });

/**
 * Fetch reference prices for parts using a waterfall strategy:
 * 1. PartSupplier price for THIS supplier (most relevant)
 * 2. Historical average from past SupplierQuoteItems (last 6 months)
 * 3. Catalog price from Part table
 * 4. undefined (no negotiation for this part)
 */
async function fetchReferencePrices(
  items: Array<{ partNumber: string; partId: string | null }>,
  supplierId: string,
  organizationId: string,
): Promise<Map<string, number | undefined>> {
  try {
  const result = new Map<string, number | undefined>();

  // Batch-fetch all data sources in parallel
  const partIds = items.map(i => i.partId).filter((id): id is string => id !== null);
  const partNumbers = items.map(i => i.partNumber);

  const [supplierPrices, historicalQuotes, catalogParts] = await Promise.all([
    // 1. PartSupplier prices for this specific supplier
    partIds.length > 0
      ? prisma.partSupplier.findMany({
          where: { partId: { in: partIds }, supplierId },
          select: { partId: true, price: true },
        })
      : Promise.resolve([]),

    // 2. Historical quote averages (last 6 months)
    prisma.supplierQuoteItem.groupBy({
      by: ['quoteRequestItemId'],
      _avg: { unitPrice: true },
      where: {
        quoteRequestItem: {
          partNumber: { in: partNumbers },
          quoteRequest: { organizationId },
        },
        createdAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
      },
    }).then(async (groups) => {
      // Map quoteRequestItemId back to partNumber
      if (groups.length === 0) return new Map<string, number>();
      const itemIds = groups.map(g => g.quoteRequestItemId);
      const qrItems = await prisma.quoteRequestItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, partNumber: true },
      });
      const idToPartNumber = new Map(qrItems.map(i => [i.id, i.partNumber]));
      // Average per partNumber (there may be multiple quoteRequestItems for the same partNumber)
      const avgByPart = new Map<string, { sum: number; count: number }>();
      for (const g of groups) {
        const pn = idToPartNumber.get(g.quoteRequestItemId);
        if (!pn || !g._avg.unitPrice) continue;
        const existing = avgByPart.get(pn) || { sum: 0, count: 0 };
        existing.sum += Number(g._avg.unitPrice);
        existing.count += 1;
        avgByPart.set(pn, existing);
      }
      const avgMap = new Map<string, number>();
      for (const [pn, { sum, count }] of avgByPart) {
        avgMap.set(pn, sum / count);
      }
      return avgMap;
    }),

    // 3. Catalog prices from Part table
    prisma.part.findMany({
      where: { partNumber: { in: partNumbers }, organizationId },
      select: { partNumber: true, price: true },
    }),
  ]);

  // Build lookup maps
  const supplierPriceByPartId = new Map(
    supplierPrices.map(sp => [sp.partId, Number(sp.price)])
  );
  const catalogPriceByPartNumber = new Map(
    catalogParts.map(p => [p.partNumber, Number(p.price)])
  );

  // Apply waterfall for each item
  for (const item of items) {
    // Priority 1: Supplier-specific price
    if (item.partId && supplierPriceByPartId.has(item.partId)) {
      const price = supplierPriceByPartId.get(item.partId)!;
      if (price > 0) {
        result.set(item.partNumber, price);
        continue;
      }
    }

    // Priority 2: Historical quote average
    const histAvg = historicalQuotes.get(item.partNumber);
    if (histAvg && histAvg > 0) {
      result.set(item.partNumber, histAvg);
      continue;
    }

    // Priority 3: Catalog price
    const catalogPrice = catalogPriceByPartNumber.get(item.partNumber);
    if (catalogPrice && catalogPrice > 0) {
      result.set(item.partNumber, catalogPrice);
      continue;
    }

    // Priority 4: No reference — skip negotiation for this part
    result.set(item.partNumber, undefined);
  }

  const populated = [...result.values()].filter(v => v !== undefined).length;
  if (populated > 0) {
    logger.info(
      { populated, total: items.length },
      'Fetched reference prices for negotiation'
    );
  }

  return result;
  } catch (error) {
    // Reference prices are a nice-to-have for negotiation — don't let a DB error
    // prevent the call from being initiated. Fall back to no negotiation.
    logger.warn({ error }, 'Failed to fetch reference prices — negotiation will be skipped');
    return new Map(items.map(i => [i.partNumber, undefined]));
  }
}

/**
 * Format phone number to E.164 format (e.g., +15551234567)
 * Handles US/Canada numbers and basic international formats
 */
function formatPhoneE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If already starts with +, return as-is after cleaning
  if (phone.trim().startsWith('+')) {
    return '+' + digits;
  }
  
  // US/Canada: 10 digits -> add +1
  if (digits.length === 10) {
    return '+1' + digits;
  }
  
  // Already has country code (11+ digits) -> add +
  if (digits.length >= 11) {
    return '+' + digits;
  }
  
  // Invalid format - return original with + prefix
  logger.warn({ phone, digits }, 'Phone number may not be in valid E.164 format');
  return '+' + digits;
}

async function processVoipCallInitiation(job: Job<VoipCallInitiationJobData>) {
  const {
    quoteRequestId,
    supplierId,
    supplierName,
    supplierPhone,
    context,
    metadata,
  } = job.data;

  logger.info(
    { quoteRequestId, supplierId, supplierName, jobId: job.id },
    'Processing VOIP call initiation'
  );

  try {
    // Check AI call limits for organization
    const organization = await prisma.organization.findUnique({
      where: { id: metadata.organizationId },
      select: {
        maxAICalls: true,
        aiCallsUsedThisMonth: true,
        aiCallsResetDate: true,
        overageEnabled: true,
        overageRate: true,
        hardCapEnabled: true,
        hardCapMultiplier: true,
        subscriptionTier: true,
        usePlatformKeys: true,
        vapiApiKey: true,
        elevenLabsApiKey: true,
      },
    });

    if (!organization) {
      throw new Error(`Organization not found: ${metadata.organizationId}`);
    }

    // Check if monthly reset is needed (first day of new month)
    const now = new Date();
    const needsReset = !organization.aiCallsResetDate || 
      organization.aiCallsResetDate.getMonth() !== now.getMonth() ||
      organization.aiCallsResetDate.getFullYear() !== now.getFullYear();

    if (needsReset) {
      // Reset counter for new month
      await prisma.organization.update({
        where: { id: metadata.organizationId },
        data: {
          aiCallsUsedThisMonth: 0,
          aiCallsResetDate: now,
        },
      });
      organization.aiCallsUsedThisMonth = 0;
    }

    // Calculate limits
    const softLimit = organization.maxAICalls;
    const hardLimit = organization.hardCapEnabled 
      ? Math.floor(softLimit * organization.hardCapMultiplier)
      : 9999; // Unlimited if no hard cap
    const currentUsage = organization.aiCallsUsedThisMonth;
    
    // Check if within included limit
    const isWithinLimit = currentUsage < softLimit;
    const isOverage = currentUsage >= softLimit && currentUsage < hardLimit;
    const isOverHardCap = currentUsage >= hardLimit && hardLimit < 9999;
    
    // Log overage status
    if (isOverage) {
      logger.info(
        { organizationId: metadata.organizationId, currentUsage, softLimit, overageRate: organization.overageRate },
        'Call will be billed as overage'
      );
    }

    // Check hard cap (9999 means unlimited)
    if (isOverHardCap) {
      const overageAmount = (hardLimit - softLimit) * Number(organization.overageRate);
      logger.warn(
        { organizationId: metadata.organizationId, currentUsage, hardLimit, overageAmount },
        'Hard cap reached'
      );
      throw new Error(
        `Hard limit reached (${hardLimit} calls). You have $${overageAmount.toFixed(2)} in pending overage charges. Contact support to increase limits.`
      );
    }

    // Check if at soft limit without overage enabled (only if not unlimited plan)
    if (currentUsage >= softLimit && !organization.overageEnabled && organization.maxAICalls < 9999) {
      logger.warn(
        { organizationId: metadata.organizationId, used: currentUsage, limit: softLimit },
        'AI call limit reached (overage not enabled)'
      );
      throw new Error(
        `AI call limit reached. Your plan allows ${softLimit} calls per month. Please upgrade your plan, enable overage billing, or wait until next month.`
      );
    }

    // If overage is enabled but no hard cap, enforce a safety limit to prevent runaway costs
    if (currentUsage >= softLimit && organization.overageEnabled && !organization.hardCapEnabled && organization.maxAICalls < 9999) {
      const defaultHardCap = softLimit * 5; // 5x soft limit as safety
      if (currentUsage >= defaultHardCap) {
        const overageAmount = (defaultHardCap - softLimit) * Number(organization.overageRate);
        logger.warn(
          { organizationId: metadata.organizationId, currentUsage, defaultHardCap, overageAmount },
          'Safety hard cap reached (5x soft limit)'
        );
        throw new Error(
          `Safety limit reached (${defaultHardCap} calls). You have $${overageAmount.toFixed(2)} in pending overage charges. Please contact support to increase limits or enable hard cap settings.`
        );
      }
    }

    // Determine threadRole from user's actual role
    const threadRole = (metadata.userRole === 'TECHNICIAN' || metadata.userRole === 'USER') ? 'TECHNICIAN' : 'MANAGER';

    // Create call log entry
    const callLog = await prisma.supplierCall.create({
      data: {
        quoteRequestId,
        supplierId,
        phoneNumber: supplierPhone,
        status: CallStatus.INITIATED,
        callDirection: 'OUTBOUND',
        callType: 'QUOTE_REQUEST',
        callerId: metadata.userId,
        organizationId: metadata.organizationId,
        threadRole,
        conversationLog: {
          context,
          initiatedBy: metadata.userId,
          preferredMethod: metadata.preferredMethod,
        } as any,
      },
    });

    // Get VAPI credentials using CredentialsManager
    const credentialsManager = new CredentialsManager();
    const vapiCreds = await credentialsManager.getCredentialsWithFallback<VapiCredentials>(
      metadata.organizationId,
      'VAPI'
    );

    if (!vapiCreds || !vapiCreds.apiKey || !vapiCreds.phoneNumberId) {
      logger.error(
        { organizationId: metadata.organizationId, hasCredentials: !!vapiCreds },
        'Missing VAPI credentials in integration_credentials table'
      );
      throw new Error(
        'VAPI credentials not configured. Please add VAPI credentials in the Admin Integrations settings.'
      );
    }

    const vapiApiKey = vapiCreds.apiKey;
    const vapiPhoneNumber = vapiCreds.phoneNumberId;
    
    logger.info(
      { 
        organizationId: metadata.organizationId,
        usePlatformKeys: organization.usePlatformKeys,
        hasApiKey: !!vapiApiKey,
        hasPhoneNumber: !!vapiPhoneNumber
      },
      'Retrieved VAPI credentials from integration_credentials'
    );

    // Extract custom call settings
    const customContext = context.customContext; // Background facts (vehicle, parts, etc.)
    const customInstructions = context.customInstructions; // Behavioral guidance

    // Build first message - natural greeting. For follow-up calls, mention it's a follow-up.
    const isFollowUp = customInstructions && (
      customInstructions.toLowerCase().includes('follow up') ||
      customInstructions.toLowerCase().includes('follow-up') ||
      customInstructions.toLowerCase().includes('previous quote') ||
      customInstructions.toLowerCase().includes('previous call')
    );
    const firstMessage = isFollowUp
      ? `Hi, good morning! Could I speak to someone in your parts department? I'm calling to follow up on a recent quote.`
      : `Hi, good morning! Could I speak to someone in your parts department?`;

    // Build system instructions for the AI agent
    // Include both the default guidelines AND the custom context/instructions
    let systemInstructions = `You are a real person calling suppliers to get parts quotes. Be natural, friendly, and conversational.

CRITICAL: Always start by asking for the parts department. Once connected, explain what you need naturally.`;

    // Append custom context (facts about this specific call)
    if (customContext) {
      systemInstructions += `\n\n## Call Information\nUse this information during your call - reference it naturally, don't read it verbatim:\n\n${customContext}`;
    }

    // Append custom behavioral instructions
    if (customInstructions) {
      systemInstructions += `\n\n## Special Instructions\n${customInstructions}`;
    }

    logger.info(
      { 
        quoteRequestId, 
        supplierId, 
        hasCustomContext: !!customContext, 
        hasCustomInstructions: !!customInstructions 
      },
      'Preparing VAPI call with LangGraph integration'
    );

    // Get app URL for webhook callbacks
    // Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL
    let appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`;
    }
    if (!appUrl) {
      throw new Error('Neither NEXT_PUBLIC_APP_URL nor VERCEL_URL is set - cannot configure VAPI callback URL');
    }

    // Ensure URL doesn't have trailing slash
    appUrl = appUrl.replace(/\/$/, '');

    logger.info(
      { 
        appUrl, 
        hasVercelUrl: !!process.env.VERCEL_URL, 
        hasPublicUrl: !!process.env.NEXT_PUBLIC_APP_URL,
        vercelUrl: process.env.VERCEL_URL,
        publicUrl: process.env.NEXT_PUBLIC_APP_URL
      },
      'Using app URL for VAPI callbacks'
    );

    // Format phone number to E.164 format
    const formattedPhone = formatPhoneE164(supplierPhone);
    logger.debug({ original: supplierPhone, formatted: formattedPhone }, 'Formatted phone number');

    // Initialize call state BEFORE making VAPI API call to avoid race condition
    // Extract parts information from quote request
    const quoteRequestData = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
      include: {
        items: true,
        organization: {
          select: { name: true },
        },
      },
    });

    if (!quoteRequestData) {
      throw new Error(`Quote request not found: ${quoteRequestId}`);
    }

    // Filter out MISC-COSTS placeholder — it's not a real part number
    const regularItems = quoteRequestData.items.filter(item => item.partNumber !== 'MISC-COSTS');
    const hasMiscCosts = quoteRequestData.items.some(item => item.partNumber === 'MISC-COSTS');

    // Fetch reference prices for negotiation (waterfall: PartSupplier → historical avg → catalog price)
    const referencePrices = await fetchReferencePrices(
      regularItems,
      supplierId,
      metadata.organizationId
    );

    const parts = regularItems.map(item => ({
      partNumber: item.partNumber,
      description: item.description || '',
      quantity: item.quantity,
      budgetMax: referencePrices.get(item.partNumber),
      source: item.source as 'CATALOG' | 'WEB_SEARCH' | 'MANUAL',
    }));

    // Fetch human-readable values for voice output
    const organizationName = quoteRequestData.organization?.name || 'our company';
    const quoteNumber = quoteRequestData.quoteNumber || 'QR-UNKNOWN';

    // Build or fix customContext to include human-readable values
    // If customContext was provided by user, preserve it but ensure it has proper format
    let finalCustomContext = customContext || '';
    
    // Check if customContext contains company and quote info - if not, prepend them
    if (!finalCustomContext.match(/Company:\s*.+/i)) {
      finalCustomContext = `Company: ${organizationName}\n${finalCustomContext}`;
    } else {
      // Replace any CUID-looking values in company line
      finalCustomContext = finalCustomContext.replace(
        /(Company:\s*)([a-z0-9]{20,})/gi,
        `$1${organizationName}`
      );
    }
    
    if (!finalCustomContext.match(/Quote Request:\s*.+/i)) {
      finalCustomContext = `Quote Request: ${quoteNumber}\n${finalCustomContext}`;
    } else {
      // Replace any CUID-looking values in quote line
      finalCustomContext = finalCustomContext.replace(
        /(Quote Request:\s*#?)([a-z0-9]{20,})/gi,
        `$1${quoteNumber}`
      );
    }

    // Include org's primary location address if available
    const primaryLocation = await prisma.organizationLocation.findFirst({
      where: { organizationId: metadata.organizationId, isPrimary: true },
    });
    if (primaryLocation) {
      finalCustomContext += `\nShipping Address: ${primaryLocation.address}, ${primaryLocation.city}, ${primaryLocation.state} ${primaryLocation.zipCode}`;
    }

    // Initialize LangGraph state and save to Redis
    const initialCallState = initializeCallState({
      callId: callLog.id,
      quoteRequestId,
      supplierId,
      supplierName,
      supplierPhone: formattedPhone,
      organizationId: metadata.organizationId,
      callerId: metadata.userId,
      parts,
      customContext: finalCustomContext.trim(),
      customInstructions: customInstructions,
      hasMiscCosts,
    });

    // Seed the first message into state so greetingNode knows it was already said
    const stateWithGreeting = addMessage(initialCallState, 'ai', firstMessage);

    try {
      await saveCallState(callLog.id, stateWithGreeting);

      logger.info(
        {
          callLogId: callLog.id,
          partsCount: parts.length,
          hasCustomContext: !!(customContext || customInstructions),
          currentNode: stateWithGreeting.currentNode
        },
        'Call state successfully saved to Redis before VAPI API call'
      );
    } catch (redisError: any) {
      logger.error(
        {
          callLogId: callLog.id,
          error: redisError.message,
          stack: redisError.stack
        },
        'Failed to save call state to Redis'
      );
      throw new Error(`Failed to save call state: ${redisError.message}`);
    }

    // Check for pre-configured VAPI assistant ID (more reliable than inline config)
    // Priority: 1. From credentials (DB), 2. Environment variable
    const vapiAssistantId = vapiCreds.assistantId || process.env.VAPI_ASSISTANT_ID;
    
    // Log URL configuration for debugging
    logger.info(
      {
        appUrl,
        langgraphHandlerUrl: `${appUrl}/api/voip/langgraph-handler`,
        webhookUrl: `${appUrl}/api/voip/webhooks`,
        usingAssistantId: !!vapiAssistantId,
        assistantIdPreview: vapiAssistantId ? vapiAssistantId.slice(0, 10) + '...' : 'none',
      },
      'VAPI URL configuration'
    );

    // Build VAPI assistant configuration (only if not using assistant ID)
    const vapiAssistantConfig = vapiAssistantId ? undefined : {
      firstMessage: firstMessage,
      context: systemInstructions,
      model: {
        provider: 'custom-llm',
        model: 'langgraph-state-machine',
        url: `${appUrl}/api/voip/langgraph-handler`,
        headers: {
          'Authorization': `Bearer ${process.env.VOIP_WEBHOOK_SECRET || 'dev-secret'}`,
        },
      },
      voice: {
        provider: 'azure',
        voiceId: 'andrew',
      },
      tools: [{ type: 'endCall' }],
      endCallPhrases: [
        'goodbye',
        'have a great day',
        'thank you for your time',
        'we\'ll follow up via email',
        'have a good one',
      ],
    };

    if (vapiAssistantConfig) {
      logger.info(
        {
          customLlmUrl: vapiAssistantConfig.model.url,
          provider: vapiAssistantConfig.model.provider,
          voiceProvider: vapiAssistantConfig.voice.provider,
          firstMessageLength: firstMessage.length,
          systemInstructionsLength: systemInstructions.length
        },
        'Built VAPI assistant configuration with custom LLM (inline)'
      );
    } else {
      logger.info(
        {
          assistantId: vapiAssistantId,
          firstMessageLength: firstMessage.length,
          systemInstructionsLength: systemInstructions.length
        },
        'Using pre-configured VAPI assistant with ID'
      );
    }

    // Filter MISC-COSTS from metadata context so it doesn't appear in call logs
    const cleanedContext = {
      ...context,
      items: (context as any).items?.filter((item: any) => item.partNumber !== 'MISC-COSTS'),
    };

    const callPayload: any = {
      phoneNumberId: vapiPhoneNumber,
      customer: {
        number: formattedPhone,
      },
      metadata: {
        quoteRequestId,
        supplierId,
        organizationId: metadata.organizationId,
        callLogId: callLog.id,
        context: JSON.stringify(cleanedContext),
        hasCustomSettings: !!(customContext || customInstructions),
      },
    };
    
    // Use assistant ID if provided, otherwise inline config
    if (vapiAssistantId) {
      callPayload.assistantId = vapiAssistantId;
      // Pass custom values via direct field overrides (NOT variableValues,
      // which only works if the Vapi dashboard template uses {{}} syntax).
      // model override MUST include provider/model/url or Vapi returns 400.
      callPayload.assistantOverrides = {
        firstMessage: firstMessage,
        model: {
          provider: 'custom-llm',
          model: 'langgraph-state-machine',
          url: `${appUrl}/api/voip/langgraph-handler`,
          messages: [{ role: 'system', content: systemInstructions }],
        },
        // VAPI rejects `tools` in assistantOverrides, so endCall tool must be
        // configured in VAPI dashboard. As a reliable fallback, use endCallPhrases
        // which trigger termination at the speech layer when the assistant says them.
        endCallPhrases: [
          'goodbye',
          'have a great day',
          'thank you for your time',
          'we\'ll follow up via email',
          'have a good one',
        ],
      };
      // Note: When using assistantId, serverUrl is pre-configured in VAPI dashboard
      // and should NOT be included in the call payload
    } else {
      callPayload.assistant = vapiAssistantConfig;
      // Only include serverUrl when using inline assistant config
      callPayload.serverUrl = `${appUrl}/api/voip/webhooks`;
    }

    // Log the full payload being sent to VAPI for debugging
    logger.info(
      {
        callPayload: JSON.stringify(callPayload, null, 2),
        customLlmEndpoint: callPayload.assistant?.model?.url || 'using-assistant-id',
        webhookEndpoint: callPayload.serverUrl || 'configured-in-assistant',
        assistantId: callPayload.assistantId || 'inline-config',
      },
      'Sending call request to VAPI'
    );

    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload),
    });

    // Get response body for detailed error logging
    const responseText = await response.text();
    let vapiCallData: any;

    if (!response.ok) {
      let errorDetails = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorDetails = JSON.stringify(errorJson, null, 2);
      } catch {
        // Response is not JSON, use as-is
      }
      
      logger.error(
        { 
          status: response.status,
          statusText: response.statusText,
          responseBody: errorDetails,
          supplierId,
          quoteRequestId 
        },
        'VAPI API call failed'
      );
      
      throw new Error(
        `VAPI call initiation failed: ${response.status} ${response.statusText} - ${errorDetails}`
      );
    }

    // Parse successful response
    try {
      vapiCallData = JSON.parse(responseText);
      logger.info(
        {
          vapiCallId: vapiCallData.id,
          status: vapiCallData.status,
          hasAssistant: !!vapiCallData.assistant,
          assistantModel: vapiCallData.assistant?.model?.provider,
          customLlmUrl: vapiCallData.assistant?.model?.url
        },
        'VAPI call created successfully, verifying custom LLM configuration'
      );
    } catch (parseError) {
      logger.error(
        { responseText, parseError },
        'Failed to parse VAPI response'
      );
      throw new Error('Failed to parse VAPI API response');
    }

    // Update call log with VAPI call ID and increment AI calls counter
    await prisma.$transaction([
      prisma.supplierCall.update({
        where: { id: callLog.id },
        data: {
          vapiCallId: vapiCallData.id,
          status: CallStatus.RINGING,
        },
      }),
      prisma.organization.update({
        where: { id: metadata.organizationId },
        data: {
          aiCallsUsedThisMonth: {
            increment: 1,
          },
        },
      }),
    ]);

    // Track overage usage if call exceeds included limit
    if (isOverage) {
      try {
        await trackOverageUsage(metadata.organizationId);
        logger.info(
          { organizationId: metadata.organizationId, currentUsage: currentUsage + 1 },
          'Overage usage tracked for AI call'
        );
      } catch (overageError) {
        logger.error(
          { organizationId: metadata.organizationId, error: overageError },
          'Failed to track overage usage - continuing anyway'
        );
      }
    }

    logger.info(
      { callId: callLog.id, vapiCallId: vapiCallData.id },
      'Call initiated successfully via VAPI and call counter incremented'
    );

    return {
      success: true,
      callId: callLog.id,
      vapiCallId: vapiCallData.id,
    };
  } catch (error: any) {
    logger.error(
      { error: error.message, quoteRequestId, supplierId },
      'Error initiating VOIP call'
    );

    // Update call log if it exists
    try {
      const existingCall = await prisma.supplierCall.findFirst({
        where: {
          quoteRequestId,
          supplierId,
          status: CallStatus.INITIATED,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingCall) {
        await prisma.supplierCall.update({
          where: { id: existingCall.id },
          data: {
            status: CallStatus.FAILED,
            endedAt: new Date(),
            notes: `Call initiation failed: ${error.message}`,
          },
        });
      }
    } catch (updateError) {
      logger.error({ error: updateError }, 'Failed to update call log after error');
    }

    // No fallback email needed — when contactMethod is 'both', the email is already
    // sent in parallel via the SendQuoteDialog UI (Gmail integration). Sending a second
    // fallback email would be redundant and confusing to suppliers.
    // User can manually retry calls from the communication history UI.

    throw error;
  }
}

export function startVoipCallInitiationWorker() {
  const worker = new Worker<VoipCallInitiationJobData>(
    QUEUE_NAMES.VOIP_CALL_INITIATION,
    async (job) => {
      return await processVoipCallInitiation(job);
    },
    {
      connection: redisConnection,
      concurrency: 5, // Process up to 5 calls simultaneously
      limiter: {
        max: 10, // Max 10 calls
        duration: 60000, // per minute (rate limiting)
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'VOIP call initiation job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, error: err.message },
      'VOIP call initiation job failed'
    );
  });

  logger.info('VOIP call initiation worker started');

  return worker;
}
