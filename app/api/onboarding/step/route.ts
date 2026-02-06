import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/onboarding/step - Update onboarding step
export async function PUT(request: Request) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { step, data } = body;

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
