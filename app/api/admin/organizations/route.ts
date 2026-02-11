import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/organizations
 * Get all organizations (Master Admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Only MASTER_ADMIN can list all organizations
    if (session.user.role !== "MASTER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        pineconeHost: true,
        usePlatformKeys: true,
        createdAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ organizations });
  } catch (error: any) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}
