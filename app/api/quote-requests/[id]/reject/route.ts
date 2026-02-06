import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canApproveQuotes } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can approve/reject quotes
    if (!canApproveQuotes(currentUser.role)) {
      return NextResponse.json(
        { error: "You do not have permission to reject quotes" },
        { status: 403 }
      );
    }

    const { id: quoteRequestId } = await params;
    const body = await request.json();
    const { notes } = body;

    if (!notes) {
      return NextResponse.json(
        { error: "Rejection notes are required" },
        { status: 400 }
      );
    }

    // Get the quote request
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: "Quote request not found" },
        { status: 404 }
      );
    }

    // Verify quote belongs to same organization
    if (quoteRequest.organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: "Quote request not found" },
        { status: 404 }
      );
    }

    // Verify quote is pending approval
    if (quoteRequest.status !== "UNDER_REVIEW") {
      return NextResponse.json(
        { error: `Cannot reject quote with status ${quoteRequest.status}` },
        { status: 400 }
      );
    }

    // Update quote request and log activity atomically
    const updatedQuoteRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.quoteRequest.update({
        where: { id: quoteRequestId },
        data: {
          status: "REJECTED",
          approvedById: currentUser.id,
          approvedAt: new Date(),
          approvalNotes: notes,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
          items: {
            include: {
              supplier: { select: { name: true } },
            },
          },
          vehicle: {
            select: { make: true, model: true, year: true },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          type: "QUOTE_REJECTED",
          title: "Quote rejected",
          description: `${currentUser.name} rejected quote ${quoteRequest.quoteNumber} from ${quoteRequest.createdBy.name}`,
          userId: currentUser.id,
          organizationId: currentUser.organizationId,
          metadata: {
            quoteRequestId,
            quoteNumber: quoteRequest.quoteNumber,
            rejectedBy: currentUser.name,
            requestedBy: quoteRequest.createdBy.name,
            notes,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({
      message: "Quote rejected",
      quoteRequest: updatedQuoteRequest,
    });
  } catch (error) {
    console.error("Error rejecting quote:", error);
    return NextResponse.json(
      { error: "Failed to reject quote" },
      { status: 500 }
    );
  }
}
