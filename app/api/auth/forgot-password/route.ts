import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { sendEmail, getPasswordResetEmailHtml, getBaseUrl } from "@/lib/email/resend";
import { checkRateLimit as checkIpRateLimit, rateLimits } from "@/lib/rate-limit";
import { withHardening } from "@/lib/api/with-hardening";

// Matches the previous inlined rateLimits.authAction (5 per 15min per IP).
export const POST = withHardening(
  {
    requireSession: false,
    rateLimit: { limit: 5, windowSeconds: 900, prefix: "auth-forgot-password", keyBy: "ip" },
  },
  async (request: Request) => {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Per-email rate limit using Redis-backed limiter (replaces unreliable in-memory Map)
    const emailRateCheck = await checkIpRateLimit(`forgot-pwd:${normalizedEmail}`, rateLimits.authAction);
    if (!emailRateCheck.success) return emailRateCheck.response;

    // Look up user (don't reveal if not found)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Return 200 to prevent email enumeration
      return NextResponse.json({ message: "If an account exists, a reset link has been sent." });
    }

    // Delete any existing reset token for this user
    await prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Create new reset token (1 hour expiry)
    const token = randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await prisma.passwordReset.create({
      data: {
        token,
        expires,
        userId: user.id,
      },
    });

    // Send reset email
    const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;
    const html = getPasswordResetEmailHtml(user.name || "User", resetUrl);

    await sendEmail({
      to: user.email,
      subject: "Reset Your Password - PartsIQ",
      html,
    });

    console.log("[Forgot Password] Reset email sent to:", normalizedEmail);

    return NextResponse.json({ message: "If an account exists, a reset link has been sent." });
  } catch (error) {
    console.error("[Forgot Password] Error:", error);
    return NextResponse.json(
      { error: "Failed to process request. Please try again." },
      { status: 500 }
    );
  }
  }
);
