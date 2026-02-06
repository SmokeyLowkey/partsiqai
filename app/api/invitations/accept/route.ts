import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// POST /api/invitations/accept - Accept invitation and create account
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, name, temporaryPassword, password, phone } = body;

    // Validate inputs
    if (!token || !name || !temporaryPassword || !password) {
      return NextResponse.json(
        { error: "Token, name, temporary password, and new password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Ensure new password is different from temporary password
    if (password === temporaryPassword) {
      return NextResponse.json(
        { error: "New password must be different from temporary password" },
        { status: 400 }
      );
    }

    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true,
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation token" },
        { status: 400 }
      );
    }

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Check if already accepted
    if (invitation.status === "ACCEPTED") {
      return NextResponse.json(
        { error: "This invitation has already been accepted" },
        { status: 400 }
      );
    }

    // Validate temporary password
    if (!invitation.temporaryPassword) {
      return NextResponse.json(
        { error: "This invitation was not set up with a temporary password" },
        { status: 400 }
      );
    }

    const isValidTemporaryPassword = await bcrypt.compare(
      temporaryPassword,
      invitation.temporaryPassword
    );

    if (!isValidTemporaryPassword) {
      return NextResponse.json(
        { error: "Invalid temporary password" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and update invitation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          name,
          phone: phone || null,
          password: hashedPassword,
          role: invitation.role,
          organizationId: invitation.organizationId,
          isEmailVerified: true, // Email verified by invitation token
          emailVerified: new Date(),
          onboardingStatus: "COMPLETED", // Invited users skip onboarding
          onboardingCompletedAt: new Date(),
        },
      });

      console.log("[INVITATION ACCEPT] User created successfully:", {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        isEmailVerified: user.isEmailVerified,
        emailVerified: user.emailVerified,
        onboardingStatus: user.onboardingStatus,
        timestamp: new Date().toISOString(),
      });

      // Update invitation
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          recipientId: user.id,
        },
      });

      console.log("[INVITATION ACCEPT] Invitation marked as accepted:", {
        invitationId: invitation.id,
        userId: user.id,
        email: user.email,
      });

      return { user };
    });

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
