import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/invitations/[id] - Revoke invitation
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN can revoke invitations
    if (session.user.role !== "ADMIN" && session.user.role !== "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Only admins can revoke invitations" },
        { status: 403 }
      );
    }

    const invitationId = params.id;

    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Ensure invitation belongs to user's organization
    if (invitation.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { error: "You can only revoke invitations from your organization" },
        { status: 403 }
      );
    }

    // Update invitation status to REVOKED
    await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: "REVOKED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Invitation revoked successfully",
    });
  } catch (error) {
    console.error("Error revoking invitation:", error);
    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}
