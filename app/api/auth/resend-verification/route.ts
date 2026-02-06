import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { sendEmail, getVerificationEmailHtml } from "@/lib/email/resend";

// Rate limiting storage (in-memory for now - consider Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(email: string): { allowed: boolean; remainingTime?: number } {
  const now = Date.now();
  const limit = rateLimitMap.get(email);

  // Clean up expired entries
  if (limit && now > limit.resetTime) {
    rateLimitMap.delete(email);
  }

  // Check rate limit (3 emails per hour)
  if (limit && now <= limit.resetTime) {
    if (limit.count >= 3) {
      const remainingTime = Math.ceil((limit.resetTime - now) / 1000 / 60); // minutes
      return { allowed: false, remainingTime };
    }
    limit.count++;
    return { allowed: true };
  }

  // First request or after reset
  rateLimitMap.set(email, {
    count: 1,
    resetTime: now + 60 * 60 * 1000, // 1 hour from now
  });

  return { allowed: true };
}

// Helper to send verification email
async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;
  const html = getVerificationEmailHtml(name, verificationUrl);

  await sendEmail({
    to: email,
    subject: "Verify Your Email - PartsIQ",
    html,
  });
}

// POST /api/auth/resend-verification - Resend verification email
export async function POST(request: Request) {
  try {
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

    // Check rate limit
    const rateLimit = checkRateLimit(user.email);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many verification emails sent. Please try again in ${rateLimit.remainingTime} minutes.`,
        },
        { status: 429 }
      );
    }

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
