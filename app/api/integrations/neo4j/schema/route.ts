import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { Neo4jSchemaDiscovery } from '@/lib/services/search/neo4j-schema-discovery';

// GET /api/integrations/neo4j/schema - Discover schema values from Neo4j
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const discover = searchParams.get('discover'); // 'all' | 'manufacturers' | 'models' | 'namespaces' | 'domains' | 'categories' | 'labels'
    const manufacturer = searchParams.get('manufacturer'); // For filtering models by manufacturer

    const discovery = await Neo4jSchemaDiscovery.fromOrganization(session.user.organizationId);

    if (!discovery) {
      return NextResponse.json(
        { error: 'Neo4j not configured for this organization' },
        { status: 400 }
      );
    }

    let data: any = {};

    try {
      switch (discover) {
        case 'all':
          data = await discovery.getFullSchema();
          break;

        case 'manufacturers':
          data.manufacturers = await discovery.getManufacturers();
          break;

        case 'models':
          if (manufacturer) {
            data.models = await discovery.getModelsByManufacturer(manufacturer);
          } else {
            // Return all models with their manufacturers
            const allModels = await discovery.getAllModels();
            data.models = allModels.map(m => m.name);
            data.modelDetails = allModels;
          }
          break;

        case 'namespaces':
          data.namespaces = await discovery.getNamespaces();
          break;

        case 'domains':
          data.technicalDomains = await discovery.getTechnicalDomains();
          break;

        case 'categories':
          data.categories = await discovery.getCategories();
          break;

        case 'labels':
          data.nodeLabels = await discovery.getNodeLabels();
          data.relationshipTypes = await discovery.getRelationshipTypes();
          break;

        default:
          // Default to full schema
          data = await discovery.getFullSchema();
      }

      await discovery.close();
      return NextResponse.json(data);
    } catch (queryError: any) {
      await discovery.close();

      // Handle specific Neo4j errors
      if (queryError.message?.includes('Connection refused') ||
          queryError.message?.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Cannot connect to Neo4j database. Please check your connection settings.' },
          { status: 503 }
        );
      }

      if (queryError.message?.includes('authentication')) {
        return NextResponse.json(
          { error: 'Neo4j authentication failed. Please check your credentials.' },
          { status: 401 }
        );
      }

      throw queryError;
    }
  } catch (error: any) {
    console.error('Neo4j schema discovery error:', error);

    return NextResponse.json(
      {
        error: 'Failed to discover Neo4j schema',
      },
      { status: 500 }
    );
  }
}
