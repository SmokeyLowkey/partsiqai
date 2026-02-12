import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['OEM_DIRECT', 'DISTRIBUTOR', 'AFTERMARKET', 'LOCAL_DEALER', 'ONLINE_RETAILER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING_APPROVAL', 'SUSPENDED']).optional(),
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
  country: z.string().optional(),
  paymentTerms: z.string().optional(),
  rating: z.number().min(0).max(5).nullish(),
  deliveryRating: z.number().min(0).max(5).nullish(),
  qualityRating: z.number().min(0).max(5).nullish(),
  avgDeliveryTime: z.number().nullish(),
  taxId: z.string().nullish(),
  certifications: z.any().optional(),
  specialties: z.any().optional(),
  preferredContactMethod: z.enum(['EMAIL', 'PHONE', 'SMS', 'BOTH']).optional(),
  timezone: z.string().optional(),
  callWindowStart: z.string().optional(),
  callWindowEnd: z.string().optional(),
  doNotCall: z.boolean().optional(),
});

// GET /api/suppliers/[id] - Get a single supplier
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

    const supplier = await prisma.supplier.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        parts: {
          include: {
            part: true,
          },
        },
        orders: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    return NextResponse.json({ supplier });
  } catch (error: any) {
    console.error('Get supplier API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch supplier',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/suppliers/[id] - Update a supplier
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
    const validationResult = UpdateSupplierSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if supplier exists and belongs to organization
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingSupplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Update supplier
    const supplier = await prisma.supplier.update({
      where: { id },
      data: validationResult.data,
    });

    return NextResponse.json({ supplier });
  } catch (error: any) {
    console.error('Update supplier API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to update supplier',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/suppliers/[id] - Delete a supplier
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

    // Check if supplier exists and belongs to organization
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingSupplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Check if supplier has associated orders or parts
    const hasOrders = await prisma.order.count({
      where: { supplierId: id },
    });

    const hasParts = await prisma.partSupplier.count({
      where: { supplierId: id },
    });

    if (hasOrders > 0 || hasParts > 0) {
      // Instead of deleting, mark as inactive
      const supplier = await prisma.supplier.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });

      return NextResponse.json({
        message: 'Supplier has existing data and was marked as inactive instead of deleted',
        supplier,
      });
    }

    // Safe to delete
    await prisma.supplier.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Supplier deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete supplier API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete supplier',
      },
      { status: 500 }
    );
  }
}
