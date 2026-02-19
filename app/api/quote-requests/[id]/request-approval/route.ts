import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requiresApproval } from "@/lib/auth";

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

    const { id: quoteRequestId } = await params;
    const body = await request.json();
    const { notes } = body;
    
    // Sanitize notes (convert empty string to null)
    const sanitizedNotes = notes && notes.trim() ? notes.trim() : null;

    // Get the quote request
    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: {
        id: quoteRequestId,
        organizationId: session.user.organizationId,
        // Technicians can only request approval for their own quotes
        ...(session.user.role === 'TECHNICIAN' && { createdById: session.user.id }),
      },
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

    // Verify user owns this quote request
    if (quoteRequest.createdById !== currentUser.id) {
      return NextResponse.json(
        { error: "You can only request approval for your own quote requests" },
        { status: 403 }
      );
    }

    // Verify user role requires approval
    if (!requiresApproval(currentUser.role)) {
      return NextResponse.json(
        { error: "Your role does not require approval" },
        { status: 400 }
      );
    }

    // Verify quote is in correct status (technicians can request approval from DRAFT, SENT, or RECEIVED)
    if (!["DRAFT", "SENT", "RECEIVED"].includes(quoteRequest.status)) {
      return NextResponse.json(
        { error: `Cannot request approval for quote with status ${quoteRequest.status}` },
        { status: 400 }
      );
    }

    // Update quote request to require approval
    const updatedQuoteRequest = await prisma.quoteRequest.update({
      where: { id: quoteRequestId },
      data: {
        requiresApproval: true,
        status: "UNDER_REVIEW",
        approvalNotes: sanitizedNotes,
      },
      include: {
        createdBy: {
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

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: "QUOTE_REQUESTED",
        title: "Quote approval requested",
        description: `${currentUser.name || currentUser.email} requested approval for quote ${quoteRequest.quoteNumber}`,
        userId: currentUser.id,
        organizationId: currentUser.organizationId,
        metadata: {
          quoteRequestId,
          quoteNumber: quoteRequest.quoteNumber,
          notes: sanitizedNotes,
        },
      },
    });

    return NextResponse.json({
      message: "Approval requested successfully",
      quoteRequest: updatedQuoteRequest,
    });
  } catch (error) {
    console.error("Error requesting approval:", error);
    return NextResponse.json(
      { error: "Failed to request approval" },
      { status: 500 }
    );
  }
}
