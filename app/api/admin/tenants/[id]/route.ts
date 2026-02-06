import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionTier, SubscriptionStatus } from "@prisma/client";

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
export async function PATCH(
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

    return NextResponse.json(updatedOrganization);
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/tenants/[id] - Delete organization (soft delete by suspending)
export async function DELETE(
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

    // Suspend the organization instead of deleting
    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: { 
        subscriptionStatus: "SUSPENDED",
      },
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
