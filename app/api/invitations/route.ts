import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID, randomBytes } from "crypto";
import { sendEmail, getBaseUrl } from "@/lib/email/resend";
import bcrypt from "bcryptjs";

// Generate a random temporary password
function generateTemporaryPassword(): string {
  // Generate 12 character password with letters and numbers
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const passwordLength = 12;
  let password = "";

  const randomBytesBuffer = randomBytes(passwordLength);
  for (let i = 0; i < passwordLength; i++) {
    password += chars[randomBytesBuffer[i] % chars.length];
  }

  return password;
}

// Helper to send invitation email
async function sendInvitationEmail(
  email: string,
  inviterName: string,
  organizationName: string,
  role: string,
  token: string,
  temporaryPassword: string,
  message?: string
) {
  const invitationUrl = `${getBaseUrl()}/invite/accept?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
        .info-box { background: white; border-left: 4px solid #9333ea; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .password-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
        .password-code { font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #92400e; font-family: monospace; background: white; padding: 12px 20px; border-radius: 6px; display: inline-block; margin: 10px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 You're Invited to PartsIQ!</h1>
        </div>
        <div class="content">
          <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on PartsIQ.</p>

          <div class="info-box">
            <p><strong>Your Role:</strong> ${role}</p>
            ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
          </div>

          <div class="password-box">
            <p style="margin: 0 0 10px 0; color: #92400e; font-weight: 600;">
              🔑 Your Temporary Password
            </p>
            <div class="password-code">${temporaryPassword}</div>
            <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">
              <strong>Important:</strong> You'll need to set a new password when you accept this invitation.
            </p>
          </div>

          <p>Click the button below to accept the invitation and create your account:</p>

          <div style="text-align: center;">
            <a href="${invitationUrl}" class="button">Accept Invitation</a>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            This invitation expires in 7 days. If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="word-break: break-all; color: #9333ea; font-size: 12px;">
            ${invitationUrl}
          </p>
        </div>
        <div class="footer">
          <p>Need help? <a href="${getBaseUrl()}/support" style="color: #9333ea;">Contact Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `${inviterName} invited you to join ${organizationName} on PartsIQ`,
    html,
  });
}

// POST /api/invitations - Create team invitation
export async function POST(request: Request) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN can invite users
    if (session.user.role !== "ADMIN" && session.user.role !== "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Only admins can invite team members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role, message } = body;

    // Validate inputs
    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ["MANAGER", "TECHNICIAN", "USER"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Can only invite MANAGER, TECHNICIAN, or USER" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Check if invitation already exists
    const existingInvitation = await prisma.invitation.findUnique({
      where: {
        organizationId_email: {
          organizationId: session.user.organizationId,
          email,
        },
      },
    });

    if (existingInvitation && existingInvitation.status === "PENDING") {
      return NextResponse.json(
        { error: "An invitation has already been sent to this email" },
        { status: 400 }
      );
    }

    // Generate invitation token
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();
    const hashedTemporaryPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        email,
        role,
        organizationId: session.user.organizationId,
        invitedBy: session.user.id,
        token,
        expiresAt,
        message: message || null,
        temporaryPassword: hashedTemporaryPassword,
      },
      include: {
        organization: true,
        inviter: true,
      },
    });

    // Send invitation email with temporary password
    await sendInvitationEmail(
      email,
      invitation.inviter.name || "A team member",
      invitation.organization.name,
      role,
      token,
      temporaryPassword, // Send plain password in email
      message
    );

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}

// GET /api/invitations - List organization's invitations
export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN can view invitations
    if (session.user.role !== "ADMIN" && session.user.role !== "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Only admins can view invitations" },
        { status: 403 }
      );
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        inviter: {
          select: {
            name: true,
            email: true,
          },
        },
        recipient: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}
