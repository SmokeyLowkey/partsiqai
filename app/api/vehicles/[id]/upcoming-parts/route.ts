import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/vehicles/[id]/upcoming-parts - Get parts needed for upcoming maintenance
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: vehicleId } = await params;

    // Get the vehicle with current operating hours
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: session.user.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Get the maintenance schedule - only if approved
    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { vehicleId },
      include: {
        intervals: {
          orderBy: { intervalHours: 'asc' },
          include: {
            requiredParts: {
              include: {
                matchedPart: {
                  include: {
                    suppliers: {
                      include: {
                        supplier: true,
                      },
                      where: {
                        supplier: {
                          status: 'ACTIVE',
                        },
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

    // If no schedule or not approved, return empty
    if (!schedule) {
      return NextResponse.json({
        upcomingService: null,
        parts: [],
        message: 'No maintenance schedule found for this vehicle.',
      });
    }

    if (schedule.approvalStatus !== 'APPROVED') {
      return NextResponse.json({
        upcomingService: null,
        parts: [],
        message: `Maintenance schedule is ${schedule.approvalStatus.toLowerCase().replace('_', ' ')}. Admin approval required.`,
        scheduleStatus: schedule.approvalStatus,
      });
    }

    const currentHours = vehicle.operatingHours;

    // Find the next upcoming interval based on current operating hours
    // Improved logic: recognize when we're AT a milestone (service due now)

    // Calculate which intervals are coming up
    const upcomingIntervals = schedule.intervals
      .filter((interval) => interval.intervalHours > 0) // Skip "As Required" intervals
      .map((interval) => {
        const intervalHours = interval.intervalHours;

        // Check if we're exactly at or just past a milestone
        const remainder = currentHours % intervalHours;
        const toleranceHours = Math.min(intervalHours * 0.1, 50); // 10% or 50 hours, whichever is smaller

        let nextServiceAtHours: number;
        let hoursUntilService: number;
        let isOverdue = false;

        if (remainder === 0 && currentHours > 0) {
          // Exactly at milestone - service is DUE NOW
          nextServiceAtHours = currentHours;
          hoursUntilService = 0;
        } else if (remainder <= toleranceHours && currentHours > 0) {
          // Just past milestone - service is OVERDUE
          const lastMilestone = currentHours - remainder;
          nextServiceAtHours = lastMilestone;
          hoursUntilService = -remainder; // Negative = overdue
          isOverdue = true;
        } else {
          // Normal case: calculate next upcoming milestone
          const completedCycles = Math.floor(currentHours / intervalHours);
          nextServiceAtHours = (completedCycles + 1) * intervalHours;
          hoursUntilService = nextServiceAtHours - currentHours;
        }

        return {
          ...interval,
          nextServiceAtHours,
          hoursUntilService,
          isOverdue,
        };
      })
      // Include intervals that are: due now, overdue, or coming up soon (within 20% or 100 hours)
      .filter((interval) =>
        interval.hoursUntilService <= 0 || // Due now or overdue
        interval.hoursUntilService <= interval.intervalHours * 0.2 ||
        interval.hoursUntilService <= 100
      )
      .sort((a, b) => {
        // Primary: overdue/due now comes first (negative or zero hours)
        const aDueNow = a.hoursUntilService <= 0;
        const bDueNow = b.hoursUntilService <= 0;
        if (aDueNow && !bDueNow) return -1;
        if (!aDueNow && bDueNow) return 1;

        // If both are due now, prefer the one with parts
        if (aDueNow && bDueNow) {
          const aHasParts = a.requiredParts.length > 0;
          const bHasParts = b.requiredParts.length > 0;
          if (aHasParts && !bHasParts) return -1;
          if (!aHasParts && bHasParts) return 1;

          // If both have parts (or both don't), prefer larger interval (more significant service)
          return b.intervalHours - a.intervalHours;
        }

        // Otherwise sort by hours until service
        return a.hoursUntilService - b.hoursUntilService;
      });

    // Get the most immediate upcoming interval
    const nextInterval = upcomingIntervals[0];

    if (!nextInterval) {
      // Find the absolute next interval (excluding As Required intervals)
      const nextAbsoluteInterval = schedule.intervals
        .filter((interval) => interval.intervalHours > 0)
        .map((interval) => {
          const completedCycles = Math.floor(currentHours / interval.intervalHours);
          const nextServiceAtHours = (completedCycles + 1) * interval.intervalHours;
          const hoursUntilService = nextServiceAtHours - currentHours;
          return {
            ...interval,
            nextServiceAtHours,
            hoursUntilService,
          };
        })
        .sort((a, b) => a.hoursUntilService - b.hoursUntilService)[0];

      return NextResponse.json({
        upcomingService: nextAbsoluteInterval
          ? {
              intervalId: nextAbsoluteInterval.id,
              serviceName: nextAbsoluteInterval.serviceName,
              serviceDescription: nextAbsoluteInterval.serviceDescription,
              category: nextAbsoluteInterval.category,
              atHours: nextAbsoluteInterval.nextServiceAtHours,
              hoursRemaining: nextAbsoluteInterval.hoursUntilService,
              intervalHours: nextAbsoluteInterval.intervalHours,
              isUrgent: false,
              isOverdue: false,
            }
          : null,
        parts: [],
        message: 'No immediate maintenance due. Next service shown for planning.',
      });
    }

    // Format parts with pricing information
    const parts = nextInterval.requiredParts.map((part) => {
      // Get best price from suppliers
      const supplierPrices = part.matchedPart?.suppliers.map((ps) => ({
        supplierId: ps.supplier.id,
        supplierName: ps.supplier.name,
        price: Number(ps.price),
        leadTime: ps.leadTime,
        supplierPartNumber: ps.supplierPartNumber,
      })) || [];

      const bestPrice = supplierPrices.length > 0
        ? supplierPrices.reduce((best, curr) =>
            curr.price < best.price ? curr : best
          )
        : null;

      return {
        id: part.id,
        partNumber: part.partNumber,
        description: part.partDescription,
        quantity: part.quantity,
        matchedPartId: part.matchedPartId,
        matchedPart: part.matchedPart
          ? {
              id: part.matchedPart.id,
              partNumber: part.matchedPart.partNumber,
              description: part.matchedPart.description,
              stockQuantity: part.matchedPart.stockQuantity,
              price: Number(part.matchedPart.price),
            }
          : null,
        bestPrice: bestPrice
          ? {
              price: bestPrice.price,
              supplierName: bestPrice.supplierName,
              supplierId: bestPrice.supplierId,
              leadTime: bestPrice.leadTime,
            }
          : null,
        allSupplierPrices: supplierPrices,
      };
    });

    // Calculate estimated total
    const estimatedTotal = parts.reduce((total, part) => {
      const unitPrice = part.bestPrice?.price || part.matchedPart?.price || 0;
      return total + unitPrice * part.quantity;
    }, 0);

    return NextResponse.json({
      upcomingService: {
        intervalId: nextInterval.id,
        serviceName: nextInterval.serviceName,
        serviceDescription: nextInterval.serviceDescription,
        category: nextInterval.category,
        atHours: nextInterval.nextServiceAtHours,
        hoursRemaining: nextInterval.hoursUntilService,
        intervalHours: nextInterval.intervalHours,
        isUrgent: nextInterval.hoursUntilService <= 50,
        isOverdue: nextInterval.isOverdue,
      },
      parts,
      estimatedTotal,
      currentOperatingHours: currentHours,
      allUpcomingIntervals: upcomingIntervals.map((interval) => ({
        intervalId: interval.id,
        serviceName: interval.serviceName,
        category: interval.category,
        atHours: interval.nextServiceAtHours,
        hoursRemaining: interval.hoursUntilService,
        partsCount: interval.requiredParts.length,
      })),
    });
  } catch (error: any) {
    console.error('Get upcoming parts API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch upcoming parts',
      },
      { status: 500 }
    );
  }
}
