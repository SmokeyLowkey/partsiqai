import { NextResponse } from "next/server";
import { getServerSession, refreshSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withHardening } from "@/lib/api/with-hardening";

// POST /api/onboarding/skip - Skip onboarding
export const POST = withHardening(
  {
    rateLimit: { limit: 10, windowSeconds: 60, prefix: "onboarding-skip", keyBy: "user" },
  },
  async (request: Request) => {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Mark onboarding as skipped
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        onboardingStatus: "SKIPPED",
        onboardingSkippedAt: new Date(),
      },
    });

    // Re-encode JWT so Edge middleware sees the updated onboardingStatus immediately
    await refreshSessionCookie(session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error skipping onboarding:", error);
    return NextResponse.json(
      { error: "Failed to skip onboarding" },
      { status: 500 }
    );
  }
  }
);
