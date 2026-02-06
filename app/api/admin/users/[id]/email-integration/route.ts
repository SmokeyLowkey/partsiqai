import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailProviderType } from "@prisma/client";
import { encryptCredentials } from "@/lib/services/credentials/encryption";

// GET /api/admin/users/[id]/email-integration - Get user's email integration
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;

    if (!currentUser || !["MASTER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    // Verify user exists and belongs to admin's org (for non-master admins)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, organizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (currentUser.role !== "MASTER_ADMIN" && user.organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: "Cannot access users from other organizations" },
        { status: 403 }
      );
    }

    // Get email integration
    const emailIntegration = await prisma.userEmailIntegration.findUnique({
      where: { userId },
      select: {
        id: true,
        providerType: true,
        emailAddress: true,
        isActive: true,
        lastUsedAt: true,
        lastTestedAt: true,
        testStatus: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        configuredByUser: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ emailIntegration });
  } catch (error) {
    console.error("Error fetching email integration:", error);
    return NextResponse.json(
      { error: "Failed to fetch email integration" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users/[id]/email-integration - Create/Update user's email integration
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;

    if (!currentUser || !["MASTER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    // Verify user exists and belongs to admin's org (for non-master admins)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, organizationId: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (currentUser.role !== "MASTER_ADMIN" && user.organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: "Cannot configure users from other organizations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { providerType, emailAddress, credentials, isActive } = body;

    if (!providerType || !emailAddress) {
      return NextResponse.json(
        { error: "Provider type and email address are required" },
        { status: 400 }
      );
    }

    // Validate provider type
    if (!["GMAIL_OAUTH", "MICROSOFT_OAUTH", "SMTP"].includes(providerType)) {
      return NextResponse.json(
        { error: "Invalid provider type" },
        { status: 400 }
      );
    }

    // Validate required fields based on provider type
    if (providerType === "SMTP") {
      if (!credentials?.host || !credentials?.port || !credentials?.username || !credentials?.password) {
        return NextResponse.json(
          { error: "SMTP requires host, port, username, and password" },
          { status: 400 }
        );
      }
    } else if (providerType === "GMAIL_OAUTH") {
      if (!credentials?.clientId || !credentials?.clientSecret) {
        return NextResponse.json(
          { error: "Gmail OAuth requires client ID and client secret" },
          { status: 400 }
        );
      }
    } else if (providerType === "MICROSOFT_OAUTH") {
      if (!credentials?.clientId || !credentials?.clientSecret) {
        return NextResponse.json(
          { error: "Microsoft OAuth requires client ID and client secret" },
          { status: 400 }
        );
      }
    }

    // Encrypt credentials with AES-256-GCM
    const encryptedCredentials = encryptCredentials(credentials || {});

    // Create or update email integration
    const emailIntegration = await prisma.userEmailIntegration.upsert({
      where: { userId },
      create: {
        userId,
        providerType: providerType as EmailProviderType,
        emailAddress,
        credentials: encryptedCredentials,
        isActive: isActive !== undefined ? isActive : true,
        configuredBy: currentUser.id,
      },
      update: {
        providerType: providerType as EmailProviderType,
        emailAddress,
        credentials: encryptedCredentials,
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        providerType: true,
        emailAddress: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: "Email integration configured successfully",
      emailIntegration,
    });
  } catch (error) {
    console.error("Error configuring email integration:", error);
    return NextResponse.json(
      { error: "Failed to configure email integration" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id]/email-integration - Remove user's email integration
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;

    if (!currentUser || !["MASTER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    // Verify user exists and belongs to admin's org
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (currentUser.role !== "MASTER_ADMIN" && user.organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: "Cannot modify users from other organizations" },
        { status: 403 }
      );
    }

    // Delete email integration
    await prisma.userEmailIntegration.delete({
      where: { userId },
    });

    return NextResponse.json({ message: "Email integration removed" });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Email integration not found" },
        { status: 404 }
      );
    }
    console.error("Error removing email integration:", error);
    return NextResponse.json(
      { error: "Failed to remove email integration" },
      { status: 500 }
    );
  }
}
