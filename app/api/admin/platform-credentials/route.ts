import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CredentialsManager, SYSTEM_ORG_ID } from "@/lib/services/credentials/credentials-manager";
import { IntegrationType } from "@prisma/client";

const credentialsManager = new CredentialsManager();

/**
 * GET /api/admin/platform-credentials - Get all platform credentials (master admin only)
 */
export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user || session.user.role !== "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Master Admin access required" },
        { status: 403 }
      );
    }

    // Ensure SYSTEM organization exists
    await ensureSystemOrganization();

    // Get decrypted credentials for each integration type
    const types: IntegrationType[] = ['VAPI', 'OPENROUTER', 'PINECONE', 'NEO4J', 'MISTRAL'];
    const credentials: any = {};

    for (const type of types) {
      try {
        const creds = await credentialsManager.getCredentials<any>(SYSTEM_ORG_ID, type);
        if (creds) {
          credentials[type] = creds;
        }
      } catch (error) {
        console.warn(`No platform credentials for ${type}`);
      }
    }

    return NextResponse.json({ credentials });
  } catch (error: any) {
    console.error("Error fetching platform credentials:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch platform credentials" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/platform-credentials - Save platform credentials (master admin only)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user || session.user.role !== "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Master Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, credentials } = body;

    if (!type || !credentials) {
      return NextResponse.json(
        { error: "Type and credentials are required" },
        { status: 400 }
      );
    }

    // Validate integration type
    const validTypes: IntegrationType[] = ['OPENROUTER', 'PINECONE', 'NEO4J', 'MISTRAL', 'VAPI'];
    if (!validTypes.includes(type as IntegrationType)) {
      return NextResponse.json(
        { error: "Invalid integration type" },
        { status: 400 }
      );
    }

    // Ensure SYSTEM organization exists
    await ensureSystemOrganization();

    // Save using existing CredentialsManager (handles encryption automatically)
    await credentialsManager.saveCredentials(
      SYSTEM_ORG_ID,
      type as IntegrationType,
      credentials,
      session.user.id,
      `Platform ${type}`,
      {}
    );

    return NextResponse.json({
      success: true,
      message: `Platform ${type} credentials saved successfully`,
    });
  } catch (error: any) {
    console.error("Error saving platform credentials:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save platform credentials" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/platform-credentials - Delete platform credentials
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user || session.user.role !== "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Master Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return NextResponse.json(
        { error: "Type is required" },
        { status: 400 }
      );
    }

    await credentialsManager.deleteCredentials(SYSTEM_ORG_ID, type as IntegrationType);

    return NextResponse.json({
      success: true,
      message: `Platform ${type} credentials deleted successfully`,
    });
  } catch (error: any) {
    console.error("Error deleting platform credentials:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete platform credentials" },
      { status: 500 }
    );
  }
}

/**
 * Ensure SYSTEM organization exists for platform credentials
 */
async function ensureSystemOrganization() {
  const existing = await prisma.organization.findUnique({
    where: { id: SYSTEM_ORG_ID },
  });

  if (!existing) {
    await prisma.organization.create({
      data: {
        id: SYSTEM_ORG_ID,
        name: "Platform System",
        slug: "system-platform",
        subscriptionTier: "ENTERPRISE",
        subscriptionStatus: "ACTIVE",
        usePlatformKeys: false, // SYSTEM org stores the platform keys
        maxUsers: 999999,
        maxVehicles: 999999,
      },
    });
    console.log("[PlatformCredentials] Created SYSTEM organization");
  }
}
