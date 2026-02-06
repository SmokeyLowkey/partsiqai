import { NextResponse } from "next/server";
import { getServerSession, canApproveQuotes } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only managers and above can see pending approval count
    if (!canApproveQuotes(session.user.role)) {
      return NextResponse.json({ count: 0 });
    }

    const count = await prisma.quoteRequest.count({
      where: {
        organizationId: session.user.organizationId,
        status: "UNDER_REVIEW",
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching pending approval count:", error);
    return NextResponse.json(
      { error: "Failed to fetch count" },
      { status: 500 }
    );
  }
}
