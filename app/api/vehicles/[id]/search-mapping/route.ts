import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/auth/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { searchMapping: true },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Check ownership or admin
    const canRead = await checkPermission('vehicle:read', vehicle.ownerId);
    if (!canRead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(vehicle.searchMapping);
  } catch (error: any) {
    console.error('[GET /api/vehicles/[id]/search-mapping] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search mapping' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CRITICAL: Only admins can configure search mappings
    const canConfigure = await checkPermission('vehicle:configure_search');
    if (!canConfigure) {
      return NextResponse.json(
        { error: 'Forbidden: Only admins can configure search mappings' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { status } = body;

    // Extract only the valid mapping fields (exclude id, relations, timestamps)
    const mappingData = {
      // Pinecone fields
      pineconeNamespace: body.pineconeNamespace || null,
      pineconeMachineModel: body.pineconeMachineModel || null,
      pineconeManufacturer: body.pineconeManufacturer || null,
      pineconeYear: body.pineconeYear || null,
      // Neo4j fields
      neo4jModelName: body.neo4jModelName || null,
      neo4jManufacturer: body.neo4jManufacturer || null,
      neo4jSerialRange: body.neo4jSerialRange || null,
      neo4jTechnicalDomains: body.neo4jTechnicalDomains || [],
      neo4jCategories: body.neo4jCategories || [],
      neo4jNamespace: body.neo4jNamespace || null,
      // PostgreSQL fields
      postgresCategory: body.postgresCategory || null,
      postgresSubcategory: body.postgresSubcategory || null,
      postgresMake: body.postgresMake || null,
      postgresModel: body.postgresModel || null,
    };

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Update vehicle status if provided
    if (status && ['PENDING_ADMIN_REVIEW', 'SEARCH_READY', 'NEEDS_UPDATE', 'INACTIVE'].includes(status)) {
      await prisma.vehicle.update({
        where: { id },
        data: { searchConfigStatus: status },
      });
    }

    // Upsert search mapping
    const mapping = await prisma.vehicleSearchMapping.upsert({
      where: { vehicleId: id },
      create: {
        vehicleId: id,
        organizationId: vehicle.organizationId,
        ...mappingData,
      },
      update: {
        ...mappingData,
      },
    });

    return NextResponse.json(mapping);
  } catch (error: any) {
    console.error('[PUT /api/vehicles/[id]/search-mapping] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update search mapping' },
      { status: 500 }
    );
  }
}
