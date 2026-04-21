import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withHardening } from "@/lib/api/with-hardening";
import { auditAdminAction } from "@/lib/audit-admin";

/**
 * PATCH /api/admin/organizations/[id]
 * Update organization settings (Master Admin only)
 */
export const PATCH = withHardening(
  {
    roles: ["MASTER_ADMIN"],
    rateLimit: { limit: 30, windowSeconds: 60, prefix: "admin-org-update", keyBy: "user" },
  },
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const body = await req.json();

    // Validate organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Update organization with allowed fields
    const updateData: any = {};
    
    if (body.pineconeHost !== undefined) {
      // Allow null or empty string to clear the field
      updateData.pineconeHost = body.pineconeHost || null;
    }

    if (body.vapiPhoneNumberId !== undefined) {
      updateData.vapiPhoneNumberId = body.vapiPhoneNumberId || null;
    }

    if (body.vapiAssistantId !== undefined) {
      updateData.vapiAssistantId = body.vapiAssistantId || null;
    }

    if (body.usePlatformKeys !== undefined) {
      updateData.usePlatformKeys = Boolean(body.usePlatformKeys);
    }

    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
      select: {
        id: true,
        name: true,
        pineconeHost: true,
        vapiPhoneNumberId: true,
        vapiAssistantId: true,
        usePlatformKeys: true,
      },
    });

    await auditAdminAction({
      req,
      session: { user: { id: session.user.id, organizationId: session.user.organizationId } },
      eventType: "ORGANIZATION_SETTINGS_CHANGED",
      description: `${session.user.email} updated platform-routing fields on org ${organization.name}`,
      targetOrganizationId: organizationId,
      metadata: {
        organizationId,
        organizationName: organization.name,
        changedFields: Object.keys(updateData),
      },
    });

    return NextResponse.json({ organization: updatedOrganization });
  } catch (error: any) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
  }
);
