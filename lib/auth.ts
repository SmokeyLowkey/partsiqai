import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { encode, decode } from "next-auth/jwt"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { UserRole, SubscriptionStatus } from "@prisma/client"
import { createAuditLog } from "@/lib/audit-log"

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Find user by email with organization
        const userWithOrg = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
          include: {
            organization: {
              select: {
                subscriptionStatus: true,
                subscriptionTier: true,
                trialEndsAt: true,
              },
            },
          },
        })
        const user = userWithOrg

        if (!user || !user.password) {
          // Log failed login attempt
          await createAuditLog({
            organizationId: user?.organizationId || "system",
            eventType: "LOGIN_FAILURE",
            description: `Failed login attempt for ${credentials.email}`,
            metadata: { email: credentials.email, reason: "User not found or no password" }
          })
          return null
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isValidPassword) {
          // Log failed login attempt
          await createAuditLog({
            organizationId: user.organizationId,
            eventType: "LOGIN_FAILURE",
            userId: user.id,
            description: `Failed login attempt for ${credentials.email} - Invalid password`,
            metadata: { email: credentials.email }
          })
          return null
        }

        // Check if user is active
        if (!user.isActive) {
          throw new Error("AccountNotActive")
        }

        // Check if email is verified (allow login but will redirect via middleware)
        // Note: We don't block login here, middleware handles the redirect

        // Update last login and log successful login
        await Promise.all([
          prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }),
          createAuditLog({
            organizationId: user.organizationId,
            eventType: "LOGIN_SUCCESS",
            userId: user.id,
            description: `User ${user.email} logged in successfully`,
            metadata: { email: credentials.email, role: user.role }
          })
        ])

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          subscriptionStatus: user.organization.subscriptionStatus,
          subscriptionTier: user.organization.subscriptionTier,
          trialEndsAt: user.organization.trialEndsAt?.toISOString() ?? null,
          isEmailVerified: user.isEmailVerified,
          onboardingStatus: user.onboardingStatus,
          mustChangePassword: user.mustChangePassword,
        }
      }
    })
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 60 * 60, // 1 hour
  },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, trigger }: { token: any; user: any; trigger?: string }) {
      // On login, user object is provided
      if (user) {
        token.id = user.id
        token.role = user.role
        token.organizationId = user.organizationId
        token.subscriptionStatus = user.subscriptionStatus
        token.subscriptionTier = user.subscriptionTier
        token.trialEndsAt = user.trialEndsAt
        token.isEmailVerified = user.isEmailVerified
        token.onboardingStatus = user.onboardingStatus
        token.mustChangePassword = user.mustChangePassword
        token.refreshedAt = Date.now()
      }

      // Refresh mutable fields from DB on update() calls OR every 30 seconds
      // This ensures middleware always has fresh data for onboardingStatus,
      // isEmailVerified, subscriptionStatus, etc.
      const now = Date.now()
      const lastRefresh = (token.refreshedAt as number) || 0
      const needsRefresh = trigger === "update" || (now - lastRefresh > 30_000)

      if (needsRefresh && token.id) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: {
              organization: {
                select: {
                  subscriptionStatus: true,
                  subscriptionTier: true,
                  trialEndsAt: true,
                },
              },
            },
          })

          if (freshUser) {
            token.role = freshUser.role
            token.organizationId = freshUser.organizationId
            token.subscriptionStatus = freshUser.organization.subscriptionStatus
            token.subscriptionTier = freshUser.organization.subscriptionTier
            token.trialEndsAt = freshUser.organization.trialEndsAt?.toISOString() ?? null
            token.isEmailVerified = freshUser.isEmailVerified
            token.onboardingStatus = freshUser.onboardingStatus
            token.mustChangePassword = freshUser.mustChangePassword
            token.refreshedAt = now
          }
        } catch {
          // DB query may fail in Edge Runtime (middleware) — use cached token data.
          // The token is still valid; we just skip the periodic refresh.
        }
      }

      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.organizationId = token.organizationId as string
        session.user.subscriptionStatus = token.subscriptionStatus as SubscriptionStatus
        session.user.subscriptionTier = token.subscriptionTier as string
        session.user.trialEndsAt = token.trialEndsAt as string | null
        session.user.isEmailVerified = token.isEmailVerified as boolean
        session.user.onboardingStatus = token.onboardingStatus as string
        session.user.mustChangePassword = token.mustChangePassword as boolean
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production"
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig as any)

// Export authOptions as an alias for compatibility
export const authOptions = authConfig

// Server-side session helper
export async function getServerSession() {
  return await auth()
}

// Role checking utilities
export function isAdminRole(role: UserRole): boolean {
  return role === "MASTER_ADMIN" || role === "ADMIN"
}

export function isCustomerRole(role: UserRole): boolean {
  return role === "MANAGER" || role === "TECHNICIAN" || role === "USER"
}

// Redirect helper based on role
export function getRedirectPathForRole(role: UserRole): string {
  if (isAdminRole(role)) {
    return "/admin/dashboard"
  }
  return "/customer/dashboard"
}

// Quote approval permissions
export function canApproveQuotes(role: UserRole): boolean {
  return role === "MANAGER" || role === "ADMIN" || role === "MASTER_ADMIN"
}

export function canConvertToOrder(role: UserRole): boolean {
  return role === "MANAGER" || role === "ADMIN" || role === "MASTER_ADMIN"
}

export function requiresApproval(role: UserRole): boolean {
  return role === "TECHNICIAN"
}

// Subscription status utilities
export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === "ACTIVE" || status === "TRIAL"
}

export function isSubscriptionBlocked(status: SubscriptionStatus): boolean {
  return status === "CANCELLED" || status === "SUSPENDED"
}

// Check subscription status from database (fresh check)
export async function checkSubscriptionStatus(organizationId: string): Promise<{
  isActive: boolean
  status: SubscriptionStatus
}> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscriptionStatus: true },
  })

  if (!org) {
    return { isActive: false, status: "CANCELLED" as SubscriptionStatus }
  }

  return {
    isActive: isSubscriptionActive(org.subscriptionStatus),
    status: org.subscriptionStatus,
  }
}

const SESSION_COOKIE = "next-auth.session-token"

function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET or AUTH_SECRET must be set")
  }
  return secret
}

/**
 * Re-encode the JWT session cookie with fresh user data from the database.
 * Call this from API routes after updating mutable session fields (e.g. onboardingStatus)
 * so that Edge middleware sees the new values immediately.
 */
export async function refreshSessionCookie(userId: string) {
  const secret = getAuthSecret()
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return

  const decoded = await decode({ token, secret, salt: SESSION_COOKIE })
  if (!decoded || decoded.id !== userId) return

  const freshUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: { select: { subscriptionStatus: true, trialEndsAt: true } } },
  })
  if (!freshUser) return

  decoded.role = freshUser.role
  decoded.organizationId = freshUser.organizationId
  decoded.subscriptionStatus = freshUser.organization.subscriptionStatus
  decoded.trialEndsAt = freshUser.organization.trialEndsAt?.toISOString() ?? null
  decoded.isEmailVerified = freshUser.isEmailVerified
  decoded.onboardingStatus = freshUser.onboardingStatus
  decoded.mustChangePassword = freshUser.mustChangePassword
  decoded.refreshedAt = Date.now()

  const newToken = await encode({ token: decoded, secret, salt: SESSION_COOKIE })

  cookieStore.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })
}
