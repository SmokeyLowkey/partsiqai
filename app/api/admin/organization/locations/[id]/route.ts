import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withHardening } from "@/lib/api/with-hardening";
import { auditAdminAction } from "@/lib/audit-admin";

// PUT /api/admin/organization/locations/[id] - Update a location
export const PUT = withHardening(
  {
    roles: ["ADMIN", "MASTER_ADMIN"],
    rateLimit: { limit: 60, windowSeconds: 60, prefix: "admin-location-update", keyBy: "org" },
  },
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    // Verify the location belongs to this org
    const existing = await prisma.organizationLocation.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, address, city, state, zipCode, country, isPrimary, phone } =
      body;

    // If setting as primary, unset isPrimary on all other locations
    if (isPrimary) {
      await prisma.organizationLocation.updateMany({
        where: { organizationId, id: { not: id } },
        data: { isPrimary: false },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (zipCode !== undefined) updateData.zipCode = zipCode;
    if (country !== undefined) updateData.country = country;
    if (isPrimary !== undefined) updateData.isPrimary = isPrimary;
    if (phone !== undefined) updateData.phone = phone;

    const location = await prisma.organizationLocation.update({
      where: { id },
      data: updateData,
    });

    await auditAdminAction({
      req,
      session: { user: { id: session.user.id, organizationId: session.user.organizationId } },
      eventType: "LOCATION_MANAGED",
      description: `${session.user.email} updated location ${location.name}`,
      metadata: { action: "update", locationId: id, changedFields: Object.keys(updateData) },
    });

    return NextResponse.json({ location });
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
  }
);

// DELETE /api/admin/organization/locations/[id] - Delete a location
export const DELETE = withHardening(
  {
    roles: ["ADMIN", "MASTER_ADMIN"],
    rateLimit: { limit: 30, windowSeconds: 60, prefix: "admin-location-delete", keyBy: "org" },
  },
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    // Verify the location belongs to this org
    const existing = await prisma.organizationLocation.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    await prisma.organizationLocation.delete({
      where: { id },
    });

    await auditAdminAction({
      req: _req,
      session: { user: { id: session.user.id, organizationId: session.user.organizationId } },
      eventType: "LOCATION_MANAGED",
      description: `${session.user.email} deleted location ${existing.name}`,
      metadata: { action: "delete", locationId: id, name: existing.name },
    });

    return NextResponse.json({ message: "Location deleted successfully" });
  } catch (error) {
    console.error("Error deleting location:", error);
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 }
    );
  }
  }
);
