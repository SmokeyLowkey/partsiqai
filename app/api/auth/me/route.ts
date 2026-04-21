import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/auth/me - Get current user's information
export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          },
        },
        emailIntegration: {
          select: {
            isActive: true,
            testStatus: true,
            errorMessage: true,
            providerType: true,
            emailAddress: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Banner surface for H16 (OAuth token revoked / expired). The worker
    // layer flips `isActive=false` + `testStatus=FAILED` + a `Reauth required:`
    // prefix on errorMessage when it detects `invalid_grant` or equivalent.
    // Clients render a banner if `integrationAlerts` is non-empty.
    const integrationAlerts: Array<{
      kind: 'email_reauth';
      providerType: string;
      emailAddress: string | null;
      message: string;
    }> = [];
    const ei = user.emailIntegration;
    if (
      ei &&
      ei.isActive === false &&
      ei.testStatus === 'FAILED' &&
      ei.errorMessage?.startsWith('Reauth required:')
    ) {
      integrationAlerts.push({
        kind: 'email_reauth',
        providerType: ei.providerType,
        emailAddress: ei.emailAddress,
        message: ei.errorMessage.replace(/^Reauth required:\s*/, ''),
      });
    }

    return NextResponse.json({ user, integrationAlerts });
  } catch (error) {
    console.error("Error fetching current user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
