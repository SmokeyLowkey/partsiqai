import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateQuoteRequestSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  supplierId: z.string().optional(),
  additionalSupplierIds: z.string().optional(),
  selectedSupplierId: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
  vehicleId: z.string().optional(),
});

// GET /api/quote-requests/[id] - Get a single quote request with all details
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

    const whereClause: any = {
      id,
      organizationId: session.user.organizationId,
    };

    // Technicians can only view their own quotes
    if (session.user.role === 'TECHNICIAN') {
      whereClause.createdById = session.user.id;
    }

    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: whereClause,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactPerson: true,
            phone: true,
            rating: true,
          },
        },
        selectedSupplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactPerson: true,
            phone: true,
            rating: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            serialNumber: true,
            vehicleId: true,
          },
        },
        items: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                email: true,
                contactPerson: true,
                phone: true,
                rating: true,
              },
            },
            supplierQuotes: {
              include: {
                supplier: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    contactPerson: true,
                    phone: true,
                    rating: true,
                  },
                },
              },
              orderBy: {
                unitPrice: 'asc',
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        emailThreads: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                email: true,
                contactPerson: true,
                phone: true,
                rating: true,
              },
            },
            emailThread: {
              include: {
                messages: {
                  orderBy: {
                    createdAt: 'desc',
                  },
                  take: 10,
                  include: {
                    attachments: {
                      select: {
                        id: true,
                        filename: true,
                        contentType: true,
                        size: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        pickList: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            name: true,
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

    // Parse additional supplier IDs and fetch them
    let additionalSuppliers: any[] = [];
    if (quoteRequest.additionalSupplierIds) {
      const additionalIds = quoteRequest.additionalSupplierIds
        .split(',')
        .filter(Boolean);
      if (additionalIds.length > 0) {
        additionalSuppliers = await prisma.supplier.findMany({
          where: {
            id: { in: additionalIds },
            organizationId: session.user.organizationId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            contactPerson: true,
            phone: true,
            rating: true,
          },
        });
      }
    }

    // Transform the response
    const response = {
      ...quoteRequest,
      totalAmount: quoteRequest.totalAmount
        ? Number(quoteRequest.totalAmount)
        : null,
      additionalSuppliers,
      items: quoteRequest.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : null,
        supplierQuotes: item.supplierQuotes.map((sq) => ({
          ...sq,
          unitPrice: Number(sq.unitPrice),
          totalPrice: Number(sq.totalPrice),
        })),
      })),
      emailThreads: quoteRequest.emailThreads.map((thread) => ({
        ...thread,
        quotedAmount: thread.quotedAmount ? Number(thread.quotedAmount) : null,
      })),
    };

    // Filter email threads for technicians - hide manager threads that are not yet visible
    if (session.user.role === 'TECHNICIAN') {
      response.emailThreads = response.emailThreads.filter(
        (t) => t.threadRole === 'TECHNICIAN' || t.visibleToCreator === true
      );
    }

    return NextResponse.json({ quoteRequest: response });
  } catch (error: any) {
    console.error('Get quote request API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch quote request',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/quote-requests/[id] - Update a quote request
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
    const validationResult = UpdateQuoteRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // Verify quote request exists and belongs to organization
    const whereClause: any = {
      id,
      organizationId: session.user.organizationId,
    };

    // Technicians can only update their own quotes
    if (session.user.role === 'TECHNICIAN') {
      whereClause.createdById = session.user.id;
    }

    const existingQuoteRequest = await prisma.quoteRequest.findFirst({
      where: whereClause,
    });

    if (!existingQuoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    const data = validationResult.data;

    // Verify supplier exists if being updated
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: data.supplierId,
          organizationId: session.user.organizationId,
        },
      });

      if (!supplier) {
        return NextResponse.json(
          { error: 'Supplier not found' },
          { status: 404 }
        );
      }
    }

    // Verify vehicle exists if being updated
    if (data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicleId,
          organizationId: session.user.organizationId,
        },
      });

      if (!vehicle) {
        return NextResponse.json(
          { error: 'Vehicle not found' },
          { status: 404 }
        );
      }
    }

    // Update quote request
    const quoteRequest = await prisma.quoteRequest.update({
      where: { id },
      data: {
        ...data,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            contactPerson: true,
            phone: true,
            rating: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            serialNumber: true,
            vehicleId: true,
          },
        },
        items: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ quoteRequest });
  } catch (error: any) {
    console.error('Update quote request API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to update quote request',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/quote-requests/[id] - Delete a quote request
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

    // Verify quote request exists and belongs to organization
    const whereClause: any = {
      id,
      organizationId: session.user.organizationId,
    };

    // Technicians can only delete their own quotes
    if (session.user.role === 'TECHNICIAN') {
      whereClause.createdById = session.user.id;
    }

    const existingQuoteRequest = await prisma.quoteRequest.findFirst({
      where: whereClause,
    });

    if (!existingQuoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of DRAFT quotes
    if (existingQuoteRequest.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only delete draft quote requests' },
        { status: 400 }
      );
    }

    // Delete quote request (items will cascade delete)
    await prisma.quoteRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete quote request API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete quote request',
      },
      { status: 500 }
    );
  }
}
