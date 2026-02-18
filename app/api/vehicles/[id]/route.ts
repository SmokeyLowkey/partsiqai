import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateVehicleSchema = z.object({
  vehicleId: z.string().min(1).optional(),
  serialNumber: z.string().min(1).optional(),
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  type: z.enum(['TRACTOR', 'COMBINE', 'SPRAYER', 'HARVESTER', 'EXCAVATOR', 'DOZER', 'DUMP_TRUCK', 'LOADER', 'CRANE', 'GRADER', 'COMPACTOR', 'OTHER']).optional(),
  industryCategory: z.enum(['CONSTRUCTION', 'AGRICULTURE', 'MINING', 'FORESTRY', 'INDUSTRIAL', 'OTHER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED']).optional(),
  currentLocation: z.string().optional(),
  operatingHours: z.number().int().min(0).optional(),
  healthScore: z.number().int().min(0).max(100).optional(),
  lastServiceDate: z.string().datetime().optional(),
  nextServiceDate: z.string().datetime().optional(),
  serviceInterval: z.number().int().positive().optional(),
  engineModel: z.string().optional(),
  specifications: z.any().optional(),
  maintenancePdfUrl: z.string().optional(),
  maintenancePdfFileName: z.string().optional(),
});

// GET /api/vehicles/[id] - Get a single vehicle
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        alerts: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        orders: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
        quoteRequests: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    return NextResponse.json({ vehicle });
  } catch (error: any) {
    console.error('Get vehicle API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch vehicle',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/vehicles/[id] - Update a vehicle
export async function PATCH(
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
    const validationResult = UpdateVehicleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if vehicle exists and belongs to organization
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingVehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const data = validationResult.data;

    // Update vehicle
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...data,
        lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : undefined,
        nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : undefined,
      },
    });

    // Check if maintenance alert should be created
    if (
      data.operatingHours !== undefined &&
      vehicle.serviceInterval &&
      vehicle.nextServiceDate
    ) {
      const hoursUntilService = vehicle.operatingHours + vehicle.serviceInterval - data.operatingHours;

      if (hoursUntilService <= 50 && hoursUntilService > 0) {
        // Create maintenance alert
        await prisma.vehicleAlert.create({
          data: {
            vehicleId: id,
            type: 'MAINTENANCE_DUE',
            severity: hoursUntilService <= 25 ? 'HIGH' : 'MEDIUM',
            title: 'Maintenance Due Soon',
            description: `Service is due in approximately ${hoursUntilService} operating hours`,
          },
        });
      }
    }

    return NextResponse.json({ vehicle });
  } catch (error: any) {
    console.error('Update vehicle API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to update vehicle',
      },
      { status: 500 }
    );
  }
}

// PUT /api/vehicles/[id] - Update a vehicle (alias for PATCH)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH(req, { params });
}

// DELETE /api/vehicles/[id] - Delete a vehicle
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if vehicle exists and belongs to organization
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingVehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Check if vehicle has associated orders or quote requests
    const hasOrders = await prisma.order.count({
      where: { vehicleId: id },
    });

    const hasQuotes = await prisma.quoteRequest.count({
      where: { vehicleId: id },
    });

    if (hasOrders > 0 || hasQuotes > 0) {
      // Instead of deleting, mark as retired
      const vehicle = await prisma.vehicle.update({
        where: { id },
        data: { status: 'RETIRED' },
      });

      return NextResponse.json({
        message: 'Vehicle has existing data and was marked as retired instead of deleted',
        vehicle,
      });
    }

    // Safe to delete - also deletes related alerts via cascade
    await prisma.vehicle.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Vehicle deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete vehicle API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete vehicle',
      },
      { status: 500 }
    );
  }
}
