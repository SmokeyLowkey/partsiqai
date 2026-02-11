import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/admin/organizations/[id]
 * Update organization settings (Master Admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Only MASTER_ADMIN can update organizations
    if (session.user.role !== "MASTER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const organizationId = params.id;
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
        usePlatformKeys: true,
      },
    });

    return NextResponse.json({ organization: updatedOrganization });
  } catch (error: any) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update organization" },
      { status: 500 }
    );
  }
}
