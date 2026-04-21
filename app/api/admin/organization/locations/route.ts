import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withHardening } from "@/lib/api/with-hardening";
import { auditAdminAction } from "@/lib/audit-admin";

// GET /api/admin/organization/locations - List all locations for the current org
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["MASTER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const organizationId = session.user.organizationId;

    const locations = await prisma.organizationLocation.findMany({
      where: { organizationId },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ locations });
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

// POST /api/admin/organization/locations - Create a new location
export const POST = withHardening(
  {
    roles: ["ADMIN", "MASTER_ADMIN"],
    rateLimit: { limit: 30, windowSeconds: 60, prefix: "admin-location-create", keyBy: "org" },
  },
  async (req: Request) => {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = true;
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizationId = session.user.organizationId;
    const body = await req.json();
    const { name, address, city, state, zipCode, country, isPrimary, phone } =
      body;

    if (!name || !address || !city || !state || !zipCode) {
      return NextResponse.json(
        { error: "Missing required fields: name, address, city, state, zipCode" },
        { status: 400 }
      );
    }

    // If this location is primary, unset isPrimary on all other locations
    if (isPrimary) {
      await prisma.organizationLocation.updateMany({
        where: { organizationId },
        data: { isPrimary: false },
      });
    }

    const location = await prisma.organizationLocation.create({
      data: {
        organizationId,
        name,
        address,
        city,
        state,
        zipCode,
        country: country || "USA",
        isPrimary: isPrimary || false,
        phone: phone || null,
      },
    });

    await auditAdminAction({
      req,
      session: { user: { id: session.user.id, organizationId: session.user.organizationId } },
      eventType: "LOCATION_MANAGED",
      description: `${session.user.email} created location ${location.name}`,
      metadata: { action: "create", locationId: location.id, name: location.name, isPrimary: location.isPrimary },
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    console.error("Error creating location:", error);
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
  }
);
