import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateQuoteNumber } from '@/lib/utils/quote-number';
import { z } from 'zod';

const CreateMaintenanceQuoteSchema = z.object({
  intervalId: z.string().min(1, 'Interval ID is required'),
  serviceName: z.string().min(1, 'Service name is required'),
  parts: z.array(
    z.object({
      partNumber: z.string(),
      description: z.string().optional(),
      quantity: z.number().min(1).default(1),
    })
  ),
});

// POST /api/vehicles/[id]/create-maintenance-quote - Create a quote request from maintenance parts
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: vehicleId } = await params;
    const body = await req.json();

    // Validate request body
    const validationResult = CreateMaintenanceQuoteSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { intervalId, serviceName, parts } = validationResult.data;

    if (parts.length === 0) {
      return NextResponse.json(
        { error: 'No parts provided for quote' },
        { status: 400 }
      );
    }

    // Verify vehicle exists and belongs to organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: session.user.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Verify the maintenance interval exists
    const interval = await prisma.maintenanceInterval.findFirst({
      where: {
        id: intervalId,
        maintenanceSchedule: {
          vehicleId,
        },
      },
      include: {
        requiredParts: true,
      },
    });

    if (!interval) {
      return NextResponse.json(
        { error: 'Maintenance interval not found' },
        { status: 404 }
      );
    }

    // Generate quote number
    const quoteNumber = await generateQuoteNumber(session.user.organizationId);

    // Create quote request with items
    const quoteRequest = await prisma.quoteRequest.create({
      data: {
        quoteNumber,
        title: `${serviceName} - ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        status: 'DRAFT',
        description: `Maintenance parts for ${serviceName} at ${vehicle.operatingHours.toLocaleString()} hours`,
        notes: `Generated from maintenance schedule for vehicle ${vehicle.vehicleId}`,
        organizationId: session.user.organizationId,
        createdById: session.user.id,
        vehicleId: vehicleId,
        supplierId: null, // Will be set when user selects supplier
        items: {
          create: [
            // Add all maintenance parts
            ...parts.map((part) => ({
              partNumber: part.partNumber,
              description: part.description || `Part ${part.partNumber}`,
              quantity: part.quantity,
              unitPrice: null, // Will be filled in from supplier quote
              totalPrice: null,
              notes: `Required for ${serviceName}`,
            })),
            // Always add MISC item for additional costs
            {
              partNumber: 'MISC-COSTS',
              description: 'Additional Costs & Fees',
              quantity: 1,
              unitPrice: 0,
              totalPrice: 0,
              notes: 'Miscellaneous costs such as shipping, freight, handling fees, etc.',
            },
          ],
        },
      },
      include: {
        items: true,
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            make: true,
            model: true,
            year: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        type: 'QUOTE_REQUESTED',
        title: 'Maintenance Quote Created',
        description: `Quote ${quoteNumber} created for ${serviceName} maintenance on ${vehicle.make} ${vehicle.model}`,
        entityType: 'QuoteRequest',
        entityId: quoteRequest.id,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        metadata: {
          vehicleId,
          intervalId,
          serviceName,
          partsCount: parts.length,
          quoteNumber,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        quoteRequest: {
          id: quoteRequest.id,
          quoteNumber: quoteRequest.quoteNumber,
          title: quoteRequest.title,
          itemCount: quoteRequest.items.length,
          vehicle: quoteRequest.vehicle,
        },
        message: `Quote ${quoteNumber} created with ${parts.length} parts`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create maintenance quote API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create quote request',
      },
      { status: 500 }
    );
  }
}
