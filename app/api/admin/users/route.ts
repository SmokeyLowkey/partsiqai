import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { sendEmail, getBaseUrl } from "@/lib/email/resend";

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

// GET /api/admin/users - List users with filters
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;
    
    if (!currentUser || !["MASTER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const role = searchParams.get("role") as UserRole | null;
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build filter conditions
    const where: any = {};

    // MASTER_ADMIN can see all users, regular ADMIN only sees their org
    if (currentUser.role !== "MASTER_ADMIN") {
      where.organizationId = currentUser.organizationId;
    } else if (organizationId) {
      where.organizationId = organizationId;
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== null && isActive !== undefined && isActive !== "") {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              subscriptionTier: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Remove sensitive data
    const sanitizedUsers = users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return NextResponse.json({
      users: sanitizedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Create new user
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;
    
    if (!currentUser || !["MASTER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      email,
      name,
      role,
      organizationId: providedOrgId,
      isActive,
    } = body;

    // For non-master admins, use their organization if not provided
    const organizationId = currentUser.role === "MASTER_ADMIN"
      ? providedOrgId
      : (providedOrgId || currentUser.organizationId);

    // Validate required fields (password is auto-generated)
    if (!email || !name || !role || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Regular ADMIN can only create users in their own organization
    if (currentUser.role !== "MASTER_ADMIN" && organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: "Cannot create users in other organizations" },
        { status: 403 }
      );
    }

    // Prevent non-master admins from creating MASTER_ADMIN users
    if (currentUser.role !== "MASTER_ADMIN" && role === "MASTER_ADMIN") {
      return NextResponse.json(
        { error: "Cannot create Master Admin users" },
        { status: 403 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: role as UserRole,
        organizationId,
        isActive: isActive !== undefined ? isActive : true,
        isEmailVerified: true, // Email verified by receiving temporary password
        emailVerified: new Date(),
        onboardingStatus: "COMPLETED", // Admin-created users skip onboarding
        onboardingCompletedAt: new Date(),
        mustChangePassword: true, // Force password change on first login
      },
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

    console.log("[ADMIN USER CREATE] User created successfully:", {
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      organizationId: newUser.organizationId,
      isEmailVerified: newUser.isEmailVerified,
      emailVerified: newUser.emailVerified,
      isActive: newUser.isActive,
      timestamp: new Date().toISOString(),
    });

    // Send temporary password email
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .password-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
            .password-code { font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #92400e; font-family: monospace; background: white; padding: 12px 20px; border-radius: 6px; display: inline-block; margin: 10px 0; }
            .info-box { background: white; border-left: 4px solid #9333ea; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to PartsIQ!</h1>
            </div>
            <div class="content">
              <p>An account has been created for you at <strong>${newUser.organization.name}</strong>.</p>

              <div class="info-box">
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Role:</strong> ${role}</p>
              </div>

              <div class="password-box">
                <p style="margin: 0 0 10px 0; color: #92400e; font-weight: 600;">
                  🔑 Your Temporary Password
                </p>
                <div class="password-code">${temporaryPassword}</div>
                <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">
                  <strong>Important:</strong> Please change this password after your first login.
                </p>
              </div>

              <p>You can log in at:</p>
              <p><a href="${getBaseUrl()}/login" style="color: #9333ea; font-weight: 600;">${getBaseUrl()}/login</a></p>
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
        subject: `Your PartsIQ Account - ${newUser.organization.name}`,
        html,
      });
    } catch (emailError) {
      console.error("Failed to send temporary password email:", emailError);
      // Don't fail user creation if email fails
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
