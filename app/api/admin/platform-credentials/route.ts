import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CredentialsManager, SYSTEM_ORG_ID } from "@/lib/services/credentials/credentials-manager";
import { IntegrationType } from "@prisma/client";
import { withHardening } from "@/lib/api/with-hardening";
import { auditAdminAction } from "@/lib/audit-admin";

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
    const types: IntegrationType[] = ['VAPI', 'OPENROUTER', 'PINECONE', 'NEO4J', 'MISTRAL', 'SERPER', 'TWILIO'];
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
      { error: "Failed to fetch platform credentials" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/platform-credentials - Save platform credentials (master admin only)
 */
export const POST = withHardening(
  {
    roles: ["MASTER_ADMIN"],
    rateLimit: { limit: 20, windowSeconds: 60, prefix: "admin-platform-creds-write", keyBy: "user" },
  },
  async (request: Request) => {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const validTypes: IntegrationType[] = ['OPENROUTER', 'PINECONE', 'NEO4J', 'MISTRAL', 'VAPI', 'SERPER', 'TWILIO'];
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

    await auditAdminAction({
      req: request,
      session: { user: { id: session.user.id, organizationId: session.user.organizationId } },
      eventType: "PLATFORM_CREDENTIAL_CHANGED",
      description: `${session.user.email} saved platform ${type} credentials`,
      targetOrganizationId: SYSTEM_ORG_ID,
      metadata: { action: "save", type },
    });

    return NextResponse.json({
      success: true,
      message: `Platform ${type} credentials saved successfully`,
    });
  } catch (error: any) {
    console.error("Error saving platform credentials:", error);
    return NextResponse.json(
      { error: "Failed to save platform credentials" },
      { status: 500 }
    );
  }
  }
);

/**
 * DELETE /api/admin/platform-credentials - Delete platform credentials
 */
export const DELETE = withHardening(
  {
    roles: ["MASTER_ADMIN"],
    rateLimit: { limit: 10, windowSeconds: 60, prefix: "admin-platform-creds-delete", keyBy: "user" },
  },
  async (request: Request) => {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    await auditAdminAction({
      req: request,
      session: { user: { id: session.user.id, organizationId: session.user.organizationId } },
      eventType: "PLATFORM_CREDENTIAL_CHANGED",
      description: `${session.user.email} deleted platform ${type} credentials`,
      targetOrganizationId: SYSTEM_ORG_ID,
      metadata: { action: "delete", type },
    });

    return NextResponse.json({
      success: true,
      message: `Platform ${type} credentials deleted successfully`,
    });
  } catch (error: any) {
    console.error("Error deleting platform credentials:", error);
    return NextResponse.json(
      { error: "Failed to delete platform credentials" },
      { status: 500 }
    );
  }
  }
);

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
