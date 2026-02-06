import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/onboarding/complete - Mark onboarding as complete
export async function POST(request: Request) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { data } = body;

    // Update user and organization
    await prisma.$transaction(async (tx) => {
      // Update user onboarding status
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          onboardingStatus: "COMPLETED",
          onboardingCompletedAt: new Date(),
          onboardingStep: 2,
        },
      });

      // Update organization if data provided
      if (data && session.user.organizationId) {
        await tx.organization.update({
          where: { id: session.user.organizationId },
          data: {
            logo: data.logo || undefined,
            primaryColor: data.primaryColor || undefined,
            onboardingCompletedAt: new Date(),
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
