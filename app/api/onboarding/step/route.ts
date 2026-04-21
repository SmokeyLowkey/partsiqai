import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withHardening } from "@/lib/api/with-hardening";
import { z } from "zod";

const OnboardingStepSchema = z.object({
  step: z.number().int().min(0).max(10),
  data: z
    .object({
      timezone: z.string().max(64).optional(),
      language: z.string().max(16).optional(),
      emailNotifications: z.boolean().optional(),
    })
    .default({}),
});

// PUT /api/onboarding/step - Update onboarding step
export const PUT = withHardening(
  {
    rateLimit: { limit: 60, windowSeconds: 60, prefix: "onboarding-step", keyBy: "user" },
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

    const body = await request.json();
    const parsed = OnboardingStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { step, data } = parsed.data;

    // Update user with step data
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        onboardingStep: step,
        onboardingStatus: "IN_PROGRESS",
        timezone: data.timezone || undefined,
        language: data.language || undefined,
        emailNotifications: data.emailNotifications !== undefined ? data.emailNotifications : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating onboarding step:", error);
    return NextResponse.json(
      { error: "Failed to save progress" },
      { status: 500 }
    );
  }
  }
);
