import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/auth/reset-password?token=xxx — validate token
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ valid: false });
    }

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: { select: { email: true } } },
    });

    if (!resetRecord) {
      return NextResponse.json({ valid: false });
    }

    if (new Date() > resetRecord.expires) {
      // Clean up expired token
      await prisma.passwordReset.delete({ where: { id: resetRecord.id } });
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      email: resetRecord.user.email,
    });
  } catch (error) {
    console.error("[Reset Password] Validation error:", error);
    return NextResponse.json({ valid: false });
  }
}

// POST /api/auth/reset-password — reset password with token
export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain uppercase, lowercase, and a number" },
        { status: 400 }
      );
    }

    // Look up token
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    if (new Date() > resetRecord.expires) {
      await prisma.passwordReset.delete({ where: { id: resetRecord.id } });
      return NextResponse.json(
        { error: "Reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: resetRecord.userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    // Delete used token
    await prisma.passwordReset.delete({ where: { id: resetRecord.id } });

    console.log("[Reset Password] Password reset for user:", resetRecord.user.email);

    return NextResponse.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("[Reset Password] Error:", error);
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }
}
