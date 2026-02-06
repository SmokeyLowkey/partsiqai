import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { getDaysSince } from '@/lib/utils/business-days';
import { z } from 'zod';

const GenerateFollowUpSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
});

// POST /api/quote-requests/[id]/generate-follow-up - Generate follow-up email content
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Validate request body
    const validationResult = GenerateFollowUpSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { supplierId } = validationResult.data;

    // Get quote request with all necessary data
    const whereClause: any = {
      id,
      organizationId: session.user.organizationId,
    };

    // Technicians can only generate follow-ups for their own quotes
    if (session.user.role === 'TECHNICIAN') {
      whereClause.createdById = session.user.id;
    }

    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: whereClause,
      include: {
        items: true,
        vehicle: {
          select: {
            make: true,
            model: true,
            year: true,
            serialNumber: true,
          },
        },
        organization: {
          select: {
            name: true,
            billingEmail: true,
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

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    // Get the email thread for this supplier
    const quoteRequestEmailThread = await prisma.quoteRequestEmailThread.findFirst({
      where: {
        quoteRequestId: id,
        supplierId,
      },
      include: {
        emailThread: {
          include: {
            messages: {
              orderBy: { sentAt: 'asc' },
            },
          },
        },
        supplier: true,
      },
    });

    if (!quoteRequestEmailThread) {
      return NextResponse.json(
        { error: 'No email thread found for this supplier' },
        { status: 404 }
      );
    }

    // Calculate days since original email
    const originalMessage = quoteRequestEmailThread.emailThread.messages.find(
      (m) => m.direction === 'OUTBOUND'
    );
    const daysSinceOriginal = originalMessage?.sentAt
      ? getDaysSince(originalMessage.sentAt)
      : 0;

    // Get previous follow-ups count
    const previousFollowUps = quoteRequestEmailThread.emailThread.messages.filter(
      (m) => m.direction === 'OUTBOUND' && m.followUpSentAt
    ).length;

    // Build parts list for reference
    const partsList = quoteRequest.items
      .map(
        (item, index) =>
          `${index + 1}. Part Number: ${item.partNumber} - ${item.description} (Qty: ${item.quantity})`
      )
      .join('\n');

    // Build vehicle info
    const vehicleInfo = quoteRequest.vehicle
      ? `${quoteRequest.vehicle.year || ''} ${quoteRequest.vehicle.make} ${quoteRequest.vehicle.model}${quoteRequest.vehicle.serialNumber ? ` (Serial: ${quoteRequest.vehicle.serialNumber})` : ''}`
      : 'Not specified';

    // Generate email using AI
    let emailContent: { subject: string; body: string };

    try {
      const llmClient = await OpenRouterClient.fromOrganization(
        session.user.organizationId
      );

      const followUpNumber = previousFollowUps + 1;
      const urgencyLevel =
        followUpNumber === 1 ? 'polite first follow-up' :
        followUpNumber === 2 ? 'gentle reminder' :
        'more urgent reminder';

      const prompt = `Generate a professional ${urgencyLevel} email for a quote request that hasn't received a response.

CONTEXT:
- Company: ${quoteRequest.organization.name}
- Contact: ${quoteRequest.createdBy.name || quoteRequest.createdBy.email}
- Quote Number: ${quoteRequest.quoteNumber}
- Supplier: ${quoteRequestEmailThread.supplier.name}
- Days since original request: ${daysSinceOriginal}
- Original subject: ${quoteRequestEmailThread.emailThread.subject}
- This is follow-up #${followUpNumber}
- Vehicle: ${vehicleInfo}

PARTS REQUESTED:
${partsList}

REQUIREMENTS:
1. Generate a subject line that references the original request (start with "Re: " or "Following Up: ")
2. Generate a professional ${urgencyLevel} email that:
   - Politely references the original quote request (Quote #${quoteRequest.quoteNumber})
   - Mentions that ${daysSinceOriginal} days have passed since the initial request
   - ${followUpNumber > 1 ? 'Acknowledges this is a follow-up reminder' : ''}
   - Reiterates interest in receiving a quote
   - Briefly mentions the parts needed
   - Asks if they need any additional information
   - Keeps a friendly, professional tone
   - Is concise (not more than 3-4 short paragraphs)
   - Includes a professional signature

Output your response as JSON with the following structure:
{
  "subject": "Re: [subject] - Follow Up",
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
      console.error('AI follow-up generation failed:', error);

      // Fallback to template-based email
      const followUpNumber = previousFollowUps + 1;
      const greeting = followUpNumber === 1 ? '' : `This is follow-up reminder #${followUpNumber}. `;

      emailContent = {
        subject: `Re: ${quoteRequestEmailThread.emailThread.subject} - Follow Up`,
        body: `Dear ${quoteRequestEmailThread.supplier.name},

${greeting}I hope this message finds you well. I'm following up on our quote request (${quoteRequest.quoteNumber}) that was sent ${daysSinceOriginal} days ago.

We are still very interested in receiving pricing and availability for the following parts:
${partsList}

${quoteRequest.vehicle ? `These parts are for our ${vehicleInfo}.` : ''}

If you need any additional information to process this request, please don't hesitate to let me know.

Looking forward to hearing from you soon.

Best regards,
${quoteRequest.createdBy.name || 'The Team'}
${quoteRequest.organization.name}
${quoteRequest.createdBy.email}`,
      };
    }

    return NextResponse.json({
      success: true,
      email: emailContent,
      context: {
        daysSinceOriginal,
        previousFollowUps,
        supplierName: quoteRequestEmailThread.supplier.name,
        originalSubject: quoteRequestEmailThread.emailThread.subject,
      },
    });
  } catch (error: any) {
    console.error('Generate follow-up API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate follow-up email',
      },
      { status: 500 }
    );
  }
}
