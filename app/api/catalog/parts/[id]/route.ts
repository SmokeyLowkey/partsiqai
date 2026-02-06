import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Fetch part with all related data
    // Parts catalog is shared - any authenticated user can view any part
    // Only the owning organization can edit (handled separately)
    const part = await prisma.part.findFirst({
      where: {
        id,
        isActive: true,
      },
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                supplierId: true,
                name: true,
                type: true,
                status: true,
                email: true,
                phone: true,
                rating: true,
                deliveryRating: true,
                qualityRating: true,
                avgDeliveryTime: true,
              },
            },
          },
          orderBy: {
            price: 'asc',
          },
        },
        maintenanceIntervalParts: {
          include: {
            maintenanceInterval: {
              select: {
                id: true,
                intervalHours: true,
                intervalType: true,
                serviceName: true,
                category: true,
                maintenanceSchedule: {
                  select: {
                    vehicle: {
                      select: {
                        id: true,
                        make: true,
                        model: true,
                        year: true,
                        vehicleId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!part) {
      return NextResponse.json({ error: 'Part not found' }, { status: 404 });
    }

    // Determine availability status
    const stockQuantity = part.stockQuantity;
    let availability: string;
    if (stockQuantity === 0) {
      availability = 'Out of Stock';
    } else if (stockQuantity <= (part.minStockLevel || 10)) {
      availability = 'Limited Stock';
    } else {
      availability = 'In Stock';
    }

    // Get best supplier price
    const activeSuppliers = part.suppliers.filter(
      (s) => s.supplier.status === 'ACTIVE'
    );
    const bestSupplier = activeSuppliers[0];

    // Get related vehicles that use this part
    const relatedVehicles = part.maintenanceIntervalParts
      .map((mip) => mip.maintenanceInterval.maintenanceSchedule?.vehicle)
      .filter(Boolean)
      .filter((vehicle, index, self) =>
        index === self.findIndex((v) => v?.id === vehicle?.id)
      );

    // Get maintenance intervals this part is used in
    const maintenanceIntervals = part.maintenanceIntervalParts.map((mip) => ({
      id: mip.maintenanceInterval.id,
      intervalHours: mip.maintenanceInterval.intervalHours,
      intervalType: mip.maintenanceInterval.intervalType,
      serviceName: mip.maintenanceInterval.serviceName,
      category: mip.maintenanceInterval.category,
      quantity: mip.quantity,
    }));

    // Transform response
    const transformedPart = {
      id: part.id,
      partNumber: part.partNumber,
      description: part.description,
      category: part.category,
      subcategory: part.subcategory,
      price: Number(part.price),
      cost: part.cost ? Number(part.cost) : null,
      stockQuantity: part.stockQuantity,
      minStockLevel: part.minStockLevel,
      maxStockLevel: part.maxStockLevel,
      availability,
      weight: part.weight ? Number(part.weight) : null,
      dimensions: part.dimensions,
      location: part.location,
      compatibility: part.compatibility,
      specifications: part.specifications,
      isObsolete: part.isObsolete,
      supersededBy: part.supersededBy,
      supersedes: part.supersedes,
      supersessionDate: part.supersessionDate,
      supersessionNotes: part.supersessionNotes,
      supplierPartNumber: part.supplierPartNumber,
      bestPrice: bestSupplier
        ? {
            price: Number(bestSupplier.price),
            supplierId: bestSupplier.supplierId,
            supplierName: bestSupplier.supplier.name,
            leadTime: bestSupplier.leadTime,
            minOrderQuantity: bestSupplier.minOrderQuantity,
          }
        : null,
      suppliers: activeSuppliers.map((s) => ({
        id: s.id,
        supplierId: s.supplierId,
        supplierName: s.supplier.name,
        supplierType: s.supplier.type,
        supplierPartNumber: s.supplierPartNumber,
        price: Number(s.price),
        leadTime: s.leadTime,
        minOrderQuantity: s.minOrderQuantity,
        isPreferred: s.isPreferred,
        rating: s.supplier.rating ? Number(s.supplier.rating) : null,
        deliveryRating: s.supplier.deliveryRating
          ? Number(s.supplier.deliveryRating)
          : null,
        qualityRating: s.supplier.qualityRating
          ? Number(s.supplier.qualityRating)
          : null,
        avgDeliveryTime: s.supplier.avgDeliveryTime,
        email: s.supplier.email,
        phone: s.supplier.phone,
      })),
      relatedVehicles,
      maintenanceIntervals,
      organizationId: part.organizationId,
      canEdit: part.organizationId === session.user.organizationId,
      createdAt: part.createdAt,
      updatedAt: part.updatedAt,
    };

    return NextResponse.json({ part: transformedPart });
  } catch (error: any) {
    console.error('Part detail API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch part',
      },
      { status: 500 }
    );
  }
}
