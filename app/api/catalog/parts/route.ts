import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const QuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  availability: z.enum(['all', 'in-stock', 'limited', 'out-of-stock']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['partNumber', 'description', 'price', 'stockQuantity', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // Parse and validate query parameters
    const params = QuerySchema.safeParse({
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      availability: searchParams.get('availability') || undefined,
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 20,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    });

    if (!params.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: params.error.errors },
        { status: 400 }
      );
    }

    const { search, category, availability, page, limit, sortBy, sortOrder } = params.data;

    // Build where clause
    // Parts catalog is shared across all organizations - any org can view
    // Only the owning organization can edit (handled in PUT/PATCH endpoints)
    const where: any = {
      isActive: true,
      isObsolete: false,
    };

    // Search filter
    if (search) {
      where.OR = [
        { partNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      where.category = category;
    }

    // Availability filter
    if (availability && availability !== 'all') {
      if (availability === 'in-stock') {
        where.stockQuantity = { gt: where.minStockLevel || 10 };
      } else if (availability === 'limited') {
        where.AND = [
          { stockQuantity: { gt: 0 } },
          { stockQuantity: { lte: where.minStockLevel || 10 } },
        ];
      } else if (availability === 'out-of-stock') {
        where.stockQuantity = 0;
      }
    }

    // Get total count for pagination
    const total = await prisma.part.count({ where });

    // Build orderBy
    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder || 'asc';
    } else {
      orderBy.partNumber = 'asc';
    }

    // Fetch parts with suppliers for best pricing
    const parts = await prisma.part.findMany({
      where,
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                rating: true,
                status: true,
              },
            },
          },
          where: {
            supplier: {
              status: 'ACTIVE',
            },
          },
          orderBy: {
            price: 'asc',
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    // Transform parts to include availability status and best price
    const transformedParts = parts.map((part) => {
      const bestSupplier = part.suppliers[0];
      const stockQuantity = part.stockQuantity;

      let availability: string;
      if (stockQuantity === 0) {
        availability = 'Out of Stock';
      } else if (stockQuantity <= (part.minStockLevel || 10)) {
        availability = 'Limited Stock';
      } else {
        availability = 'In Stock';
      }

      return {
        id: part.id,
        partNumber: part.partNumber,
        description: part.description,
        category: part.category,
        subcategory: part.subcategory,
        price: Number(part.price),
        stockQuantity: part.stockQuantity,
        availability,
        minStockLevel: part.minStockLevel,
        compatibility: part.compatibility,
        specifications: part.specifications,
        weight: part.weight ? Number(part.weight) : null,
        dimensions: part.dimensions,
        location: part.location,
        supersededBy: part.supersededBy,
        supersedes: part.supersedes,
        bestPrice: bestSupplier ? {
          price: Number(bestSupplier.price),
          supplierId: bestSupplier.supplierId,
          supplierName: bestSupplier.supplier.name,
          leadTime: bestSupplier.leadTime,
        } : null,
        supplierCount: part.suppliers.length,
        organizationId: part.organizationId,
        canEdit: part.organizationId === session.user.organizationId,
        createdAt: part.createdAt,
        updatedAt: part.updatedAt,
      };
    });

    // Get unique categories for filter dropdown (from all active parts)
    const categories = await prisma.part.findMany({
      where: {
        isActive: true,
        category: { not: null },
      },
      select: {
        category: true,
      },
      distinct: ['category'],
    });

    return NextResponse.json({
      parts: transformedParts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      categories: categories.map((c) => c.category).filter(Boolean),
    });
  } catch (error: any) {
    console.error('Parts catalog API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch parts',
      },
      { status: 500 }
    );
  }
}
