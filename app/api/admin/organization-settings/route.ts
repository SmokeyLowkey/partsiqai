import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/organization-settings - Get organization settings
export async function GET() {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;

    if (!currentUser || !["MASTER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logo: true,
        primaryColor: true,
        passwordPolicy: true,
        sessionTimeoutMinutes: true,
        requireTwoFactor: true,
        allowedEmailDomains: true,
        settings: true,
        maxUsers: true,
        maxVehicles: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        usePlatformKeys: true,
        pineconeHost: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ organization });
  } catch (error) {
    console.error("Error fetching organization settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization settings" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/organization-settings - Update organization settings
export async function PUT(request: Request) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;

    if (!currentUser || !["MASTER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      logo,
      primaryColor,
      passwordPolicy,
      sessionTimeoutMinutes,
      requireTwoFactor,
      allowedEmailDomains,
      settings,
      usePlatformKeys,
    } = body;

    // Build update data - only include fields that were provided
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (logo !== undefined) updateData.logo = logo;
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
    if (passwordPolicy !== undefined) updateData.passwordPolicy = passwordPolicy;
    if (sessionTimeoutMinutes !== undefined) {
      updateData.sessionTimeoutMinutes = parseInt(sessionTimeoutMinutes) || 60;
    }
    if (requireTwoFactor !== undefined) updateData.requireTwoFactor = requireTwoFactor;
    if (allowedEmailDomains !== undefined) updateData.allowedEmailDomains = allowedEmailDomains;
    if (settings !== undefined) updateData.settings = settings;
    if (usePlatformKeys !== undefined) updateData.usePlatformKeys = usePlatformKeys;

    const organization = await prisma.organization.update({
      where: { id: currentUser.organizationId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logo: true,
        primaryColor: true,
        passwordPolicy: true,
        sessionTimeoutMinutes: true,
        requireTwoFactor: true,
        allowedEmailDomains: true,
        settings: true,
        usePlatformKeys: true,
        pineconeHost: true,
      },
    });

    return NextResponse.json({
      message: "Organization settings updated successfully",
      organization,
    });
  } catch (error) {
    console.error("Error updating organization settings:", error);
    return NextResponse.json(
      { error: "Failed to update organization settings" },
      { status: 500 }
    );
  }
}
