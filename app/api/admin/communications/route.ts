import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/communications - List email threads and communications
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;
    
    if (!currentUser || !["MASTER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {};

    if (currentUser.role !== "MASTER_ADMIN") {
      where.organizationId = currentUser.organizationId;
    } else if (organizationId) {
      where.organizationId = organizationId;
    }

    if (status) {
      where.status = status;
    }

    const [threads, total] = await Promise.all([
      prisma.emailThread.findMany({
        where,
        include: {
          organization: {
            select: { id: true, name: true },
          },
          supplier: {
            select: { id: true, name: true, email: true },
          },
          messages: {
            select: {
              id: true,
              subject: true,
              direction: true,
              sentAt: true,
              receivedAt: true,
            },
            orderBy: { sentAt: "desc" },
            take: 1,
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailThread.count({ where }),
    ]);

    return NextResponse.json({
      threads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching email threads:", error);
    return NextResponse.json(
      { error: "Failed to fetch email threads" },
      { status: 500 }
    );
  }
}
