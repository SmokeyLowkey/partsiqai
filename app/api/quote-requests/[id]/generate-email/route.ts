import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';

// POST /api/quote-requests/[id]/generate-email - Generate quote request email content using AI
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

    // Get quote request with all necessary data
    const whereClause: any = {
      id,
      organizationId: session.user.organizationId,
    };

    // Technicians can only generate emails for their own quotes
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
            vehicleId: true,
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

    // Build parts list for the email (exclude MISC-COSTS)
    const regularItems = quoteRequest.items.filter(item => item.partNumber !== 'MISC-COSTS');
    const miscCostsItem = quoteRequest.items.find(item => item.partNumber === 'MISC-COSTS');
    
    const partsList = regularItems
      .map(
        (item, index) =>
          `${index + 1}. Part Number: ${item.partNumber}\n   Description: ${item.description}\n   Quantity: ${item.quantity}`
      )
      .join('\n\n');
    
    // Build additional costs question if MISC-COSTS exists
    const additionalCostsNote = miscCostsItem 
      ? `\n\nADDITIONAL REQUEST:\nPlease also provide any ${miscCostsItem.description.toLowerCase()} (such as shipping, freight, handling fees, or other charges) that may apply to this order.`
      : '';

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

      const prompt = `Generate a professional quote request email for the following parts order.

COMPANY INFORMATION:
- Company Name: ${quoteRequest.organization.name}
- Contact Person: ${quoteRequest.createdBy.name || quoteRequest.createdBy.email}
- Contact Email: ${quoteRequest.createdBy.email}

QUOTE REQUEST DETAILS:
- Quote Number: ${quoteRequest.quoteNumber}
- Vehicle: ${vehicleInfo}

PARTS REQUESTED:
${partsList}${additionalCostsNote}

REQUIREMENTS:
1. Generate a professional, concise email subject line
2. Generate a professional email body that:
   - Introduces the company and the request
   - Lists all the parts needed with quantities
   - Mentions the vehicle context if provided
   - Requests pricing, availability, and estimated lead times
   - Asks about any alternatives for parts that may be out of stock${miscCostsItem ? '\n   - Asks about additional costs like shipping, freight, handling fees, or other charges' : ''}
   - Thanks them for their time
   - Includes a professional signature

Output your response as JSON with the following structure:
{
  "subject": "the email subject line",
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
      console.error('AI email generation failed:', error);

      // Fallback to template-based email
      emailContent = {
        subject: `Quote Request ${quoteRequest.quoteNumber} - Parts for ${vehicleInfo}`,
        body: `Dear Supplier,

We are requesting a quote for the following parts:

${partsList}

Vehicle: ${vehicleInfo}

Please provide:
- Unit pricing for each part
- Current availability
- Estimated lead times
- Any alternative parts if items are not available${miscCostsItem ? '\n- Additional costs (shipping, freight, handling fees, etc.)' : ''}

Quote Reference: ${quoteRequest.quoteNumber}

Please respond at your earliest convenience.

Best regards,
${quoteRequest.createdBy.name || 'The Team'}
${quoteRequest.organization.name}
${quoteRequest.createdBy.email}`,
      };
    }

    return NextResponse.json({
      success: true,
      email: emailContent,
    });
  } catch (error: any) {
    console.error('Generate quote email API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate email',
      },
      { status: 500 }
    );
  }
}
