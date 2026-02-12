import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const SupplierSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  name: z.string().min(1, 'Supplier name is required'),
  type: z.enum(['OEM_DIRECT', 'DISTRIBUTOR', 'AFTERMARKET', 'LOCAL_DEALER', 'ONLINE_RETAILER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING_APPROVAL', 'SUSPENDED']).default('ACTIVE'),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional().transform((val) => {
    if (!val || val === '') return undefined;
    // Add https:// if no protocol is specified
    if (val && !val.match(/^https?:\/\//)) {
      return `https://${val}`;
    }
    return val;
  }),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default('USA'),
  paymentTerms: z.string().optional(),
  rating: z.number().min(0).max(5).nullish(),
  deliveryRating: z.number().min(0).max(5).nullish(),
  qualityRating: z.number().min(0).max(5).nullish(),
  avgDeliveryTime: z.number().nullish(),
  taxId: z.string().nullish(),
  certifications: z.any().optional(),
  specialties: z.any().optional(),
});

// GET /api/suppliers - List all suppliers for the organization
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
        { name: { contains: search, mode: 'insensitive' } },
        { supplierId: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ suppliers });
  } catch (error: any) {
    console.error('Get suppliers API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch suppliers',
      },
      { status: 500 }
    );
  }
}

// POST /api/suppliers - Create a new supplier
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // DEBUG: Log incoming request body
    console.log('=== SUPPLIER CREATE DEBUG ===');
    console.log('Incoming body:', JSON.stringify(body, null, 2));

    // Validate request body
    const validationResult = SupplierSchema.safeParse(body);

    // DEBUG: Log validation result
    console.log('Validation success:', validationResult.success);
    if (!validationResult.success) {
      console.log('Validation errors:', JSON.stringify(validationResult.error.errors, null, 2));
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if supplier ID already exists for this organization
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        organizationId: session.user.organizationId,
        supplierId: data.supplierId,
      },
    });

    if (existingSupplier) {
      return NextResponse.json(
        {
          error: 'Supplier ID already exists',
        },
        { status: 409 }
      );
    }

    // Create supplier
    const supplier = await prisma.supplier.create({
      data: {
        ...data,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error: any) {
    console.error('Create supplier API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create supplier',
      },
      { status: 500 }
    );
  }
}
