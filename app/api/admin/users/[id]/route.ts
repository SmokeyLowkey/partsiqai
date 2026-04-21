import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { withHardening } from "@/lib/api/with-hardening";
import { auditAdminAction } from "@/lib/audit-admin";

// PATCH /api/admin/users/[id] - Update user
export const PATCH = withHardening(
  {
    roles: ["ADMIN", "MASTER_ADMIN"],
    rateLimit: { limit: 60, windowSeconds: 60, prefix: "admin-user-update", keyBy: "user" },
  },
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession();
    const currentUser = session!.user;

    const { id: userId } = await params;
    const body = await request.json();

    // Get the user to update
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToUpdate) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Regular ADMIN can only update users in their own organization
    if (
      currentUser.role !== "MASTER_ADMIN" &&
      userToUpdate.organizationId !== currentUser.organizationId
    ) {
      return NextResponse.json(
        { error: "Cannot update users in other organizations" },
        { status: 403 }
      );
    }

    // Prevent non-master admins from setting MASTER_ADMIN role
    if (currentUser.role !== "MASTER_ADMIN" && body.role === "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Cannot assign Master Admin role" },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.role !== undefined) updateData.role = body.role as UserRole;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.twoFactorEnabled !== undefined) updateData.twoFactorEnabled = body.twoFactorEnabled;

    // Password updates should be handled through password reset flow, not admin panel

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          },
        },
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    // Differentiate the audit event: role changes and (de)activation are
    // higher-severity than a name/email update.
    const roleChanged = body.role !== undefined && body.role !== userToUpdate.role;
    const deactivated = body.isActive === false && userToUpdate.isActive === true;
    const reactivated = body.isActive === true && userToUpdate.isActive === false;

    const eventType = roleChanged
      ? "ROLE_CHANGED"
      : deactivated
      ? "USER_DEACTIVATED"
      : reactivated
      ? "USER_REACTIVATED"
      : "USER_UPDATED";

    const description = roleChanged
      ? `${currentUser.email} changed role of ${userToUpdate.email}: ${userToUpdate.role} → ${body.role}`
      : deactivated
      ? `${currentUser.email} deactivated ${userToUpdate.email}`
      : reactivated
      ? `${currentUser.email} reactivated ${userToUpdate.email}`
      : `${currentUser.email} updated user ${userToUpdate.email}`;

    await auditAdminAction({
      req: request,
      session: { user: { id: currentUser.id, organizationId: currentUser.organizationId } },
      eventType,
      description,
      targetOrganizationId: userToUpdate.organizationId,
      metadata: {
        targetUserId: userToUpdate.id,
        targetUserEmail: userToUpdate.email,
        changedFields: Object.keys(updateData),
        ...(roleChanged ? { previousRole: userToUpdate.role, newRole: body.role } : {}),
      },
    });

    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
  }
);

// DELETE /api/admin/users/[id] - Delete user (soft delete by setting isActive = false)
export const DELETE = withHardening(
  {
    roles: ["ADMIN", "MASTER_ADMIN"],
    rateLimit: { limit: 20, windowSeconds: 60, prefix: "admin-user-delete", keyBy: "user" },
  },
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession();
    const currentUser = session!.user;

    const { id: userId } = await params;

    // Prevent self-deletion
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Get the user to delete
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToDelete) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Regular ADMIN can only delete users in their own organization
    if (
      currentUser.role !== "MASTER_ADMIN" &&
      userToDelete.organizationId !== currentUser.organizationId
    ) {
      return NextResponse.json(
        { error: "Cannot delete users in other organizations" },
        { status: 403 }
      );
    }

    // Soft delete by setting isActive to false
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await auditAdminAction({
      req: request,
      session: { user: { id: currentUser.id, organizationId: currentUser.organizationId } },
      eventType: "USER_DEACTIVATED",
      description: `${currentUser.email} deactivated ${userToDelete.email}`,
      targetOrganizationId: userToDelete.organizationId,
      metadata: {
        targetUserId: userToDelete.id,
        targetUserEmail: userToDelete.email,
      },
    });

    return NextResponse.json({
      message: "User deactivated successfully",
      userId: updatedUser.id
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
  }
);

// GET /api/admin/users/[id] - Get single user details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;
    
    if (!currentUser || !["MASTER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        _count: {
          select: {
            orders: true,
            quoteRequestsCreated: true,
            vehicles: true,
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

    // Regular ADMIN can only view users in their own organization
    if (
      currentUser.role !== "MASTER_ADMIN" &&
      user.organizationId !== currentUser.organizationId
    ) {
      return NextResponse.json(
        { error: "Cannot view users in other organizations" },
        { status: 403 }
      );
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
