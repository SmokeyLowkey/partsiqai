import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionTier, SubscriptionStatus } from "@prisma/client";

// GET /api/admin/tenants - List organizations/tenants
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

    const { searchParams } = new URL(request.url);
    const subscriptionTier = searchParams.get("subscriptionTier") as SubscriptionTier | null;
    const subscriptionStatus = searchParams.get("subscriptionStatus") as SubscriptionStatus | null;
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build filter conditions
    const where: any = {};

    if (subscriptionTier) {
      where.subscriptionTier = subscriptionTier;
    }

    if (subscriptionStatus) {
      where.subscriptionStatus = subscriptionStatus;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { domain: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get organizations with pagination
    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
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
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    return NextResponse.json({
      organizations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

// POST /api/admin/tenants - Create new organization/tenant
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;
    
    if (!currentUser || currentUser.role !== "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Master Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      domain,
      subscriptionTier,
      subscriptionStatus,
      maxUsers,
      maxVehicles,
      settings,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    // Check if organization with same name or domain already exists
    if (domain) {
      const existing = await prisma.organization.findUnique({
        where: { domain },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Organization with this domain already exists" },
          { status: 400 }
        );
      }
    }

    // Create organization
    // Generate slug from name
    const slug = domain || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    const newOrganization = await prisma.organization.create({
      data: {
        name,
        slug,
        domain,
        subscriptionTier: subscriptionTier || "STARTER",
        subscriptionStatus: subscriptionStatus || "TRIAL",
        maxUsers: maxUsers || 5,
        maxVehicles: maxVehicles || 10,
        settings: settings || {},
      },
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

    return NextResponse.json(newOrganization, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
