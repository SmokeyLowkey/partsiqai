import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { sendEmail, getVerificationEmailHtml, getBaseUrl } from "@/lib/email/resend";
import { checkRateLimit as checkIpRateLimit, getClientIp, rateLimits } from "@/lib/rate-limit";

// Per-email rate limiting now uses the shared Redis-backed rate limiter.
// The in-memory Map approach was unreliable in serverless (each invocation gets a fresh Map).

// Helper to send verification email
async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
) {
  const verificationUrl = `${getBaseUrl()}/verify-email?token=${token}`;
  const html = getVerificationEmailHtml(name, verificationUrl);

  await sendEmail({
    to: email,
    subject: "Verify Your Email - PartsIQ",
    html,
  });
}

// POST /api/auth/resend-verification - Resend verification email
export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP to prevent abuse
    const ip = getClientIp(request);
    const ipRateCheck = await checkIpRateLimit(`resend-verify:${ip}`, rateLimits.authAction);
    if (!ipRateCheck.success) return ipRateCheck.response;

    const session = await getServerSession();

    // If no session, user must be unverified and trying to resend
    // We need to get their email from the request body
    let userEmail: string | null | undefined;
    let user: any;

    if (session?.user) {
      // User is logged in but unverified
      userEmail = session.user.email;

      if (!userEmail) {
        return NextResponse.json(
          { error: "Email address not found in session" },
          { status: 400 }
        );
      }

      user = await prisma.user.findUnique({
        where: { email: userEmail },
      });
    } else {
      // User is not logged in - they need to provide email
      const body = await request.json();
      userEmail = body.email;

      if (!userEmail) {
        return NextResponse.json(
          { error: "Email address is required" },
          { status: 400 }
        );
      }

      user = await prisma.user.findUnique({
        where: { email: userEmail },
      });
    }

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json(
        { message: "If an account exists, a verification email has been sent." },
        { status: 200 }
      );
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return NextResponse.json(
        { error: "Email is already verified" },
        { status: 400 }
      );
    }

    // Per-email rate limit using Redis-backed limiter
    const emailRateCheck = await checkIpRateLimit(`resend-verify:${user.email}`, rateLimits.authAction);
    if (!emailRateCheck.success) return emailRateCheck.response;

    // Generate new verification token
    const verificationToken = randomUUID();
    const verificationExpiry = new Date();
    verificationExpiry.setHours(verificationExpiry.getHours() + 24); // 24-hour expiry

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      },
    });

    // Send verification email
    await sendVerificationEmail(user.email, user.name || "User", verificationToken);

    return NextResponse.json(
      {
        success: true,
        message: "Verification email sent successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error resending verification email:", error);
    return NextResponse.json(
      { error: "Failed to resend verification email. Please try again." },
      { status: 500 }
    );
  }
}
