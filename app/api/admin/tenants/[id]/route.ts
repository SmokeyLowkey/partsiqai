import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withHardening } from "@/lib/api/with-hardening";
import { auditAdminAction } from "@/lib/audit-admin";
import { SubscriptionTier, SubscriptionStatus } from "@prisma/client";
import { deleteTenantIndex } from "@/lib/services/pinecone/index-provisioner";

// GET /api/admin/tenants/[id] - Get single organization details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;
    
    if (!currentUser || currentUser.role !== "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Master Admin access required" },
        { status: 403 }
      );
    }

    const { id: organizationId } = await params;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        _count: {
          select: {
            users: true,
            vehicles: true,
            orders: true,
            quoteRequests: true,
            parts: true,
            emailThreads: true,
            activityLogs: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/tenants/[id] - Update organization
export const PATCH = withHardening(
  {
    roles: ["MASTER_ADMIN"],
    rateLimit: { limit: 30, windowSeconds: 60, prefix: "admin-tenant-update", keyBy: "user" },
  },
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession();
    const currentUser = session!.user;

    const { id: organizationId } = await params;
    const body = await request.json();

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.domain !== undefined) updateData.domain = body.domain;
    if (body.subscriptionTier !== undefined) {
      updateData.subscriptionTier = body.subscriptionTier as SubscriptionTier;
    }
    if (body.subscriptionStatus !== undefined) {
      updateData.subscriptionStatus = body.subscriptionStatus as SubscriptionStatus;
    }
    if (body.subscriptionStartDate !== undefined) {
      updateData.subscriptionStartDate = new Date(body.subscriptionStartDate);
    }
    if (body.subscriptionEndDate !== undefined) {
      updateData.subscriptionEndDate = new Date(body.subscriptionEndDate);
    }
    if (body.maxUsers !== undefined) updateData.maxUsers = body.maxUsers;
    if (body.maxVehicles !== undefined) updateData.maxVehicles = body.maxVehicles;
    if (body.settings !== undefined) updateData.settings = body.settings;
    if (body.logo !== undefined) updateData.logo = body.logo;
    if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor;

    // Update organization
    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
      include: {
        _count: {
          select: {
            users: true,
            vehicles: true,
            orders: true,
            quoteRequests: true,
            parts: true,
          },
        },
      },
    });

    await auditAdminAction({
      req: request,
      session: { user: { id: currentUser.id, organizationId: currentUser.organizationId } },
      eventType: "TENANT_MANAGED",
      description: `${currentUser.email} updated tenant ${updatedOrganization.name}`,
      targetOrganizationId: updatedOrganization.id,
      metadata: {
        action: "update",
        tenantId: updatedOrganization.id,
        changedFields: Object.keys(body),
      },
    });

    return NextResponse.json(updatedOrganization);
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
  }
);

// DELETE /api/admin/tenants/[id] - Delete organization
// Default: soft delete (suspend). Use ?hard=true for permanent deletion.
// Hard delete removes Pinecone index too, so keep the cap tight.
export const DELETE = withHardening(
  {
    roles: ["MASTER_ADMIN"],
    rateLimit: { limit: 10, windowSeconds: 60, prefix: "admin-tenant-delete", keyBy: "user" },
  },
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: organizationId } = await params;
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get("hard") === "true";

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (hardDelete) {
      // Hard delete: remove all data and cleanup external resources
      // Delete Pinecone index (non-blocking — don't fail if Pinecone is down)
      if (organization.slug) {
        deleteTenantIndex(organization.slug).catch((error) => {
          console.error(`Failed to delete Pinecone index for org ${organization.slug}:`, error);
        });
      }

      // Audit BEFORE the delete so the row still exists and FK is valid.
      await auditAdminAction({
        req: request,
        session: { user: { id: session.user.id, organizationId: session.user.organizationId } },
        eventType: "TENANT_MANAGED",
        description: `${session.user.email} hard-deleted tenant ${organization.name} (${organization.slug})`,
        // The target org row is about to be deleted — file the audit under
        // the actor's own org so the row survives the cascade.
        metadata: {
          action: "hard_delete",
          deletedTenantId: organization.id,
          deletedTenantSlug: organization.slug,
          deletedTenantName: organization.name,
        },
      });

      // Hard delete the organization (cascades to related records via Prisma schema)
      await prisma.organization.delete({
        where: { id: organizationId },
      });

      return NextResponse.json({
        message: "Organization permanently deleted",
        organizationId,
      });
    }

    // Soft delete: suspend the organization
    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: "SUSPENDED",
      },
    });

    await auditAdminAction({
      req: request,
      session: { user: { id: session.user.id, organizationId: session.user.organizationId } },
      eventType: "TENANT_MANAGED",
      description: `${session.user.email} suspended tenant ${organization.name}`,
      targetOrganizationId: organizationId,
      metadata: { action: "suspend", tenantId: organizationId },
    });

    return NextResponse.json({
      message: "Organization suspended successfully",
      organizationId: updatedOrganization.id
    });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    );
  }
  }
);
