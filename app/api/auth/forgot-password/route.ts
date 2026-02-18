import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { sendEmail, getPasswordResetEmailHtml, getBaseUrl } from "@/lib/email/resend";
import { checkRateLimit as checkIpRateLimit, getClientIp, rateLimits } from "@/lib/rate-limit";

// Rate limiting (3 requests per email per hour)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(email: string): { allowed: boolean; remainingTime?: number } {
  const now = Date.now();
  const limit = rateLimitMap.get(email);

  if (limit && now > limit.resetTime) {
    rateLimitMap.delete(email);
  }

  if (limit && now <= limit.resetTime) {
    if (limit.count >= 3) {
      const remainingTime = Math.ceil((limit.resetTime - now) / 1000 / 60);
      return { allowed: false, remainingTime };
    }
    limit.count++;
    return { allowed: true };
  }

  rateLimitMap.set(email, {
    count: 1,
    resetTime: now + 60 * 60 * 1000,
  });

  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP to prevent enumeration/abuse
    const ip = getClientIp(request);
    const ipRateCheck = checkIpRateLimit(`forgot-pwd:${ip}`, rateLimits.authAction);
    if (!ipRateCheck.success) return ipRateCheck.response;

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limit
    const rateLimit = checkRateLimit(normalizedEmail);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many reset requests. Please try again in ${rateLimit.remainingTime} minutes.` },
        { status: 429 }
      );
    }

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
