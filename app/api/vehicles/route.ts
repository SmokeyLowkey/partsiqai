import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const VehicleSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle ID is required'),
  serialNumber: z.string().min(1, 'Serial number is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  type: z.enum(['EXCAVATOR', 'DOZER', 'DUMP_TRUCK', 'LOADER', 'CRANE', 'GRADER', 'COMPACTOR', 'OTHER']),
  industryCategory: z.enum(['CONSTRUCTION', 'AGRICULTURE', 'FORESTRY']).default('CONSTRUCTION'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED']).default('ACTIVE'),
  currentLocation: z.string().optional(),
  operatingHours: z.number().int().min(0).default(0),
  healthScore: z.number().int().min(0).max(100).default(100),
  lastServiceDate: z.string().datetime().optional(),
  nextServiceDate: z.string().datetime().optional(),
  serviceInterval: z.number().int().positive().optional(),
  engineModel: z.string().optional(),
  specifications: z.any().optional(),
  maintenancePdfUrl: z.string().optional(),
  maintenancePdfFileName: z.string().optional(),
});

// GET /api/vehicles - List all vehicles for the organization
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const where: any = {
      organizationId: session.user.organizationId,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (type && type !== 'all') {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { vehicleId: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        vehicleId: true,
        serialNumber: true,
        make: true,
        model: true,
        year: true,
        type: true,
        industryCategory: true,
        status: true,
        currentLocation: true,
        operatingHours: true,
        healthScore: true,
        lastServiceDate: true,
        nextServiceDate: true,
        serviceInterval: true,
        engineModel: true,
        maintenancePdfFileName: true,
        maintenancePdfUrl: true,
      },
    });

    return NextResponse.json({ vehicles });
  } catch (error: any) {
    console.error('Get vehicles API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch vehicles',
      },
      { status: 500 }
    );
  }
}

// POST /api/vehicles - Create a new vehicle
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate request body
    const validationResult = VehicleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check vehicle limit for organization
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { maxVehicles: true },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const vehicleCount = await prisma.vehicle.count({
      where: { organizationId: session.user.organizationId },
    });

    if (vehicleCount >= organization.maxVehicles) {
      return NextResponse.json(
        {
          error: 'Vehicle limit reached',
          message: `Your current plan allows ${organization.maxVehicles} vehicles. Please upgrade your plan to add more vehicles.`,
          limit: organization.maxVehicles,
          current: vehicleCount,
        },
        { status: 403 }
      );
    }

    // Check if vehicle ID already exists for this organization
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        organizationId: session.user.organizationId,
        OR: [
          { vehicleId: data.vehicleId },
          { serialNumber: data.serialNumber },
        ],
      },
    });

    if (existingVehicle) {
      return NextResponse.json(
        {
          error: existingVehicle.vehicleId === data.vehicleId
            ? 'Vehicle ID already exists'
            : 'Serial number already exists',
        },
        { status: 409 }
      );
    }

    // Create vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        ...data,
        organizationId: session.user.organizationId,
        ownerId: session.user.id,
        lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : undefined,
        nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : undefined,
      },
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error: any) {
    console.error('Create vehicle API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create vehicle',
      },
      { status: 500 }
    );
  }
}
