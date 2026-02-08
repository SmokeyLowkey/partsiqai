import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { sendEmail, getVerificationEmailHtml, getMasterAdminNotificationHtml, getBaseUrl } from "@/lib/email/resend";

// Helper to generate organization slug from company name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Helper to send verification email
async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
) {
  const verificationUrl = `${getBaseUrl()}/verify-email?token=${token}`;
  const html = getVerificationEmailHtml(name, verificationUrl);

  await sendEmail({
    to: email,
    subject: "Verify Your Email - PartsIQ",
    html,
  });
}

// Helper to notify master admins
async function notifyMasterAdmins(
  companyName: string,
  contactName: string,
  email: string,
  phone: string,
  industry: string,
  companySize: string,
  primaryUseCase: string,
  trialEndsAt: Date
) {
  // Get all master admins
  const masterAdmins = await prisma.user.findMany({
    where: {
      role: "MASTER_ADMIN",
      isActive: true,
      isEmailVerified: true,
    },
    select: {
      email: true,
      name: true,
    },
  });

  const html = getMasterAdminNotificationHtml(
    companyName,
    contactName,
    email,
    phone,
    industry,
    companySize,
    primaryUseCase,
    trialEndsAt
  );

  // Send to all master admins
  const emailPromises = masterAdmins.map((admin) =>
    sendEmail({
      to: admin.email,
      subject: `New Organization Signup - ${companyName}`,
      html,
    }).catch((error) => {
      console.error(`Failed to send notification to ${admin.email}:`, error);
      // Don't throw - we don't want to fail the signup if admin notification fails
    })
  );

  await Promise.allSettled(emailPromises);
}

// POST /api/auth/signup - Self-service organization signup
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      name,
      phone,
      companyName,
      industry,
      companySize,
      primaryUseCase,
    } = body;

    // Validate required fields
    if (
      !email ||
      !password ||
      !name ||
      !phone ||
      !companyName ||
      !industry ||
      !companySize ||
      !primaryUseCase
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password strength (min 8 chars, at least 1 uppercase, 1 lowercase, 1 number)
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one uppercase letter" },
        { status: 400 }
      );
    }
    if (!/[a-z]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one lowercase letter" },
        { status: 400 }
      );
    }
    if (!/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one number" },
        { status: 400 }
      );
    }

    // Validate industry
    const validIndustries = ["Construction", "Agriculture", "Forestry", "Other"];
    if (!validIndustries.includes(industry)) {
      return NextResponse.json(
        { error: "Invalid industry selection" },
        { status: 400 }
      );
    }

    // Validate company size
    const validSizes = ["1-10", "11-50", "51-200", "201-500", "500+"];
    if (!validSizes.includes(companySize)) {
      return NextResponse.json(
        { error: "Invalid company size selection" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in instead." },
        { status: 400 }
      );
    }

    // Generate organization slug
    const baseSlug = generateSlug(companyName);
    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token
    const verificationToken = randomUUID();
    const verificationExpiry = new Date();
    verificationExpiry.setHours(verificationExpiry.getHours() + 24); // 24-hour expiry

    // Create organization and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: companyName,
          slug,
          subscriptionTier: "BASIC",
          subscriptionStatus: "TRIAL",
          trialEndsAt,
          maxUsers: 10,
          maxVehicles: 50,
          primaryContactPhone: phone,
          companySize,
          primaryUseCase,
        },
      });

      // Create user as ADMIN
      const user = await tx.user.create({
        data: {
          email,
          name,
          phone,
          password: hashedPassword,
          role: "ADMIN",
          organizationId: organization.id,
          isEmailVerified: false,
          emailVerificationToken: verificationToken,
          emailVerificationExpiry: verificationExpiry,
          onboardingStatus: "NOT_STARTED",
          onboardingStep: 0,
        },
      });

      return { organization, user };
    });

    // Send verification email only (welcome email will be sent after verification)
    await sendVerificationEmail(result.user.email, result.user.name || "User", verificationToken);

    // Notify master admins after a delay to avoid rate limiting (2 emails/sec limit)
    // Don't await - run in background
    setTimeout(() => {
      notifyMasterAdmins(
        companyName,
        name,
        email,
        phone,
        industry,
        companySize,
        primaryUseCase,
        trialEndsAt
      ).catch((error) => {
        console.error("Failed to notify master admins:", error);
        // Don't fail the signup if admin notification fails
      });
    }, 1500); // 1.5 second delay to respect rate limit

    // Return success response (without sensitive data)
    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. Please check your email to verify your account.",
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        organization: {
          id: result.organization.id,
          name: result.organization.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error during signup:", error);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
