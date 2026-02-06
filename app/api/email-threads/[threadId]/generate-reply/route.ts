import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { z } from 'zod';

const GenerateReplySchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  scenario: z.enum(['general', 'price_negotiation', 'add_parts', 'availability']),
  additionalContext: z.string().optional(),
  quoteRequestId: z.string().optional(),
});

// POST /api/email-threads/[threadId]/generate-reply - Generate AI reply to supplier message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { threadId } = await params;
    const body = await req.json();

    // Validate request body
    const validationResult = GenerateReplySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { messageId, scenario, additionalContext, quoteRequestId } = validationResult.data;

    // Get the email thread with messages and supplier info
    const emailThread = await prisma.emailThread.findFirst({
      where: {
        id: threadId,
        organizationId: session.user.organizationId,
      },
      include: {
        messages: {
          where: { id: messageId },
        },
        supplier: true,
      },
    });

    console.log('=== GENERATE REPLY - Thread Details ===');
    console.log('Thread ID:', threadId);
    console.log('External Thread ID:', emailThread?.externalThreadId);
    console.log('Message ID:', messageId);
    console.log('Original Message External ID:', emailThread?.messages[0]?.externalMessageId);
    console.log('=======================================');

    if (!emailThread) {
      return NextResponse.json(
        { error: 'Email thread not found' },
        { status: 404 }
      );
    }

    if (!emailThread.supplier) {
      return NextResponse.json(
        { error: 'No supplier associated with this thread' },
        { status: 400 }
      );
    }

    const originalMessage = emailThread.messages[0];
    if (!originalMessage) {
      return NextResponse.json(
        { error: 'Original message not found' },
        { status: 404 }
      );
    }

    // Get quote request context if available
    let quoteRequestContext = '';
    if (quoteRequestId) {
      const quoteRequest = await prisma.quoteRequest.findFirst({
        where: {
          id: quoteRequestId,
          organizationId: session.user.organizationId,
        },
        include: {
          items: true,
          vehicle: {
            select: {
              make: true,
              model: true,
              year: true,
            },
          },
          organization: {
            select: {
              name: true,
            },
          },
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (quoteRequest) {
        const partsList = quoteRequest.items
          .map((item) => `- ${item.partNumber}: ${item.description} (Qty: ${item.quantity})`)
          .join('\n');

        const vehicleInfo = quoteRequest.vehicle
          ? `${quoteRequest.vehicle.year || ''} ${quoteRequest.vehicle.make} ${quoteRequest.vehicle.model}`
          : 'Not specified';

        quoteRequestContext = `
QUOTE REQUEST CONTEXT:
- Quote Number: ${quoteRequest.quoteNumber}
- Company: ${quoteRequest.organization.name}
- Contact: ${quoteRequest.createdBy.name || quoteRequest.createdBy.email}
- Vehicle: ${vehicleInfo}
- Parts Requested:
${partsList}
`;
      }
    }

    // Build scenario-specific prompts
    let scenarioInstructions = '';
    switch (scenario) {
      case 'price_negotiation':
        scenarioInstructions = `
SCENARIO: Price Negotiation
${additionalContext ? `Customer's price goal: ${additionalContext}` : ''}

Generate a professional email that:
1. Thanks the supplier for their quote
2. Expresses interest in working together
3. Politely asks if there's room for price adjustment${additionalContext ? ` (mention the target: ${additionalContext})` : ''}
4. Mentions willingness to discuss volume commitments, payment terms, or other factors
5. Maintains a collaborative, not adversarial tone
6. Ends with openness to discussion`;
        break;

      case 'add_parts':
        scenarioInstructions = `
SCENARIO: Add Parts to Quote
${additionalContext ? `Additional part numbers needed: ${additionalContext}` : ''}

Generate a professional email that:
1. Thanks the supplier for their quote
2. Asks if they can add pricing for additional parts${additionalContext ? ` (specifically: ${additionalContext})` : ''}
3. Explains this would be part of the same order
4. Asks for combined pricing if possible
5. Requests timeline for the expanded quote`;
        break;

      case 'availability':
        scenarioInstructions = `
SCENARIO: Request Availability Update

Generate a professional email that:
1. Thanks the supplier for their quote
2. Asks for updated availability and lead times
3. Requests confirmation of current stock status
4. Asks if expedited shipping is available if needed
5. Expresses urgency if timeline is critical`;
        break;

      default: // general
        scenarioInstructions = `
SCENARIO: General Response

Generate a professional email that:
1. Thanks the supplier for their response
2. Acknowledges receipt of their information
3. Asks any clarifying questions if needed based on their message
4. Expresses continued interest in working together
5. Provides next steps or asks what information they need`;
    }

    // Generate reply using AI
    let emailContent: { subject: string; body: string };

    try {
      const llmClient = await OpenRouterClient.fromOrganization(
        session.user.organizationId
      );

      const prompt = `Generate a professional reply email to a supplier's message.

SUPPLIER MESSAGE:
Subject: ${emailThread.subject}
From: ${emailThread.supplier.name}
Message: ${originalMessage.body}

${quoteRequestContext}

${scenarioInstructions}

REQUIREMENTS:
1. Keep the email concise and professional (2-3 paragraphs maximum)
2. Use a friendly but business-appropriate tone
3. Be specific and actionable
4. Include a professional signature
5. Subject line should start with "Re: " if replying to the same topic
6. Use \\n for line breaks in the body

Output your response as JSON with the following structure:
{
  "subject": "Re: [subject]",
  "body": "the email body (use \\n for line breaks)"
}`;

      const response = await llmClient.generateStructuredOutput<{
        subject: string;
        body: string;
      }>(prompt, {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['subject', 'body'],
      });

      emailContent = response;
    } catch (error: any) {
      console.error('AI reply generation failed:', error);

      // Fallback to template-based email
      const getTemplateForScenario = () => {
        const supplierName = emailThread.supplier?.name || 'Supplier';
        const userName = session.user.name || 'The Team';
        
        switch (scenario) {
          case 'price_negotiation':
            return {
              subject: `Re: ${emailThread.subject} - Price Discussion`,
              body: `Dear ${supplierName},

Thank you for your quote. We appreciate the detailed pricing information.

We're very interested in moving forward with this order. ${additionalContext ? `Would it be possible to discuss pricing closer to ${additionalContext}?` : 'Would there be any room for price adjustment?'} We're happy to discuss volume commitments, payment terms, or other factors that might help reach a mutually beneficial arrangement.

Looking forward to your thoughts on this.

Best regards,
${userName}`,
            };

          case 'add_parts':
            return {
              subject: `Re: ${emailThread.subject} - Additional Parts`,
              body: `Dear ${supplierName},

Thank you for your quote. We appreciate your prompt response.

Could you please add pricing for the following additional part numbers as well? ${additionalContext || 'We have a few more items we need quoted.'} These would be part of the same order.

${additionalContext || 'Please let me know if you need any additional information.'}

Looking forward to your updated quote.

Best regards,
${userName}`,
            };

          case 'availability':
            return {
              subject: `Re: ${emailThread.subject} - Availability Update`,
              body: `Dear ${supplierName},

Thank you for your quote.

Could you please provide updated availability and lead times for the quoted items? We'd like to confirm current stock status and understand the expected delivery timeline.

If expedited shipping is available, please let us know the options and costs.

Thank you for your assistance.

Best regards,
${userName}`,
            };

          default: // general
            return {
              subject: `Re: ${emailThread.subject}`,
              body: `Dear ${supplierName},

Thank you for your message. We appreciate your response.

${additionalContext || 'We are reviewing the information you provided and will get back to you with any questions.'}

Please let me know if you need any additional information from our side.

Best regards,
${userName}`,
            };
        }
      };

      emailContent = getTemplateForScenario();
    }

    return NextResponse.json({
      success: true,
      email: emailContent,
      context: {
        supplierName: emailThread.supplier.name,
        scenario,
        originalSubject: emailThread.subject,
        threadId: emailThread.id, // Include thread ID in response
        externalThreadId: emailThread.externalThreadId, // Include external thread ID
        messageId: originalMessage.id, // Include message ID
        externalMessageId: originalMessage.externalMessageId, // Include external message ID
      },
    });
  } catch (error: any) {
    console.error('Generate reply API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate reply email',
      },
      { status: 500 }
    );
  }
}
