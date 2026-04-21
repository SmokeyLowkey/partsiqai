import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withHardening } from "@/lib/api/with-hardening";
import { auditAdminAction } from "@/lib/audit-admin";

// GET /api/admin/settings - Get system settings
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;
    
    if (!currentUser || currentUser.role !== "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Master Admin access required" },
        { status: 403 }
      );
    }

    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// POST /api/admin/settings - Create or update system setting
export const POST = withHardening(
  {
    roles: ["MASTER_ADMIN"],
    rateLimit: { limit: 30, windowSeconds: 60, prefix: "admin-settings-write", keyBy: "user" },
  },
  async (request: Request) => {
  try {
    const session = await getServerSession();
    const currentUser = session!.user;

    const body = await request.json();
    const { key, value, category, description } = body;

    if (!key || !value) {
      return NextResponse.json(
        { error: "Key and value are required" },
        { status: 400 }
      );
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value, category, description },
      create: { key, value, category, description },
    });

    await auditAdminAction({
      req: request,
      session: { user: { id: currentUser.id, organizationId: currentUser.organizationId } },
      eventType: "ORGANIZATION_SETTINGS_CHANGED",
      description: `${currentUser.email} set platform setting ${key}`,
      metadata: { key, category },
    });

    return NextResponse.json(setting);
  } catch (error) {
    console.error("Error updating setting:", error);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    );
  }
  }
);
