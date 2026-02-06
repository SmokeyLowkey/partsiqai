import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, getWelcomeEmailHtml } from "@/lib/email/resend";

// GET /api/auth/verify-email?token=xxx - Verify email with token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      );
    }

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
      },
      include: {
        organization: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid verification token" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
      return NextResponse.json(
        { error: "Verification token has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return NextResponse.json(
        { message: "Email is already verified" },
        { status: 200 }
      );
    }

    // Update user - mark as verified and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    // Send welcome email with setup instructions (don't fail verification if this fails)
    try {
      const html = getWelcomeEmailHtml(user.name || "User", user.organization.name);
      await sendEmail({
        to: user.email,
        subject: "Welcome to PartsIQ - Setup Guide",
        html,
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't throw - verification is complete even if welcome email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: "Email verified successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error verifying email:", error);
    return NextResponse.json(
      { error: "Failed to verify email. Please try again." },
      { status: 500 }
    );
  }
}
