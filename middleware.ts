import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

const ADMIN_ROLES = ["MASTER_ADMIN", "ADMIN"]
const CUSTOMER_ROLES = ["MANAGER", "TECHNICIAN", "USER"]

// Routes that don't require an active subscription
const SUBSCRIPTION_EXEMPT_ROUTES = [
  "/admin/billing",
  "/customer/billing",
  "/subscription-required",
  "/onboarding",
  "/change-password",
]

// API routes that are legitimately public (no user auth needed)
const PUBLIC_API_PREFIXES = [
  "/api/auth/",           // NextAuth + signup/verify/reset
  "/api/webhooks/",       // Stripe/Resend (verify their own signatures)
  "/api/health",          // Health check
  "/api/og",              // Open Graph image
  "/api/cron/",           // Cron jobs (use CRON_SECRET)
  "/api/voip/webhooks",   // VoIP callbacks (external service)
  "/api/voip/langgraph-handler", // Vapi LLM handler
  "/api/invitations/",    // Invitation accept/validate (token-based)
  "/api/integrations/gmail/callback",     // OAuth callback
  "/api/integrations/microsoft/callback", // OAuth callback
]

export async function middleware(request: NextRequest) {
  // www → non-www redirect (fixes GSC canonical issue)
  const hostname = request.headers.get('host') || ''
  if (hostname.startsWith('www.')) {
    const newUrl = new URL(request.url)
    newUrl.host = hostname.replace('www.', '')
    return NextResponse.redirect(newUrl, 301)
  }

  const { pathname } = request.nextUrl

  // Public routes - allow all
  const publicRoutes = [
    "/",
    "/features",
    "/pricing",
    "/security",
    "/about",
    "/contact",
    "/support",
    "/signup",
    "/signup/verify-email",
    "/verify-email",
    "/invite/accept",
    "/forgot-password",
    "/reset-password",
    "/sitemap.xml",
    "/robots.txt",
  ]

  const publicPrefixes = ["/blog", "/solutions"]

  if (
    publicRoutes.includes(pathname) ||
    publicPrefixes.some(prefix => pathname.startsWith(prefix)) ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next()
  }

  // API route hardening: require auth unless explicitly public
  if (pathname.startsWith("/api/")) {
    const isPublicApi = PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
    if (isPublicApi) {
      return NextResponse.next()
    }

    // All other API routes require a valid session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Admin API routes require admin role
    if (pathname.startsWith("/api/admin/")) {
      if (!ADMIN_ROLES.includes(session.user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.next()
  }

  // Get session
  const session = await auth()

  // Login page logic
  if (pathname === "/login") {
    if (session?.user) {
      // Redirect authenticated users to their dashboard
      const redirectPath = ADMIN_ROLES.includes(session.user.role)
        ? "/admin/dashboard"
        : "/customer/dashboard"
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }
    return NextResponse.next()
  }

  // Protected routes - require authentication
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Email verification check
  if (session.user && !session.user.isEmailVerified) {
    const allowedPaths = [
      "/signup/verify-email",
      "/verify-email",
      "/login",
      "/api/auth/resend-verification",
    ]
    const isAllowedPath = allowedPaths.some(path => pathname.startsWith(path))

    if (!isAllowedPath) {
      return NextResponse.redirect(new URL("/signup/verify-email", request.url))
    }
  }

  // Password change redirect (for users with temporary passwords)
  if (
    session.user &&
    session.user.mustChangePassword &&
    !pathname.startsWith("/change-password")
  ) {
    return NextResponse.redirect(new URL("/change-password", request.url))
  }

  // Onboarding redirect (only for verified users)
  if (
    session.user &&
    session.user.isEmailVerified &&
    session.user.onboardingStatus === "NOT_STARTED" &&
    !pathname.startsWith("/onboarding")
  ) {
    return NextResponse.redirect(new URL("/onboarding/welcome", request.url))
  }

  // Check if route is exempt from subscription check
  const isExemptRoute = SUBSCRIPTION_EXEMPT_ROUTES.some(route => pathname.startsWith(route))

  // Check subscription status (unless on exempt route)
  if (!isExemptRoute) {
    const subscriptionStatus = session.user.subscriptionStatus

    // Block access if subscription is cancelled or suspended
    if (subscriptionStatus === "CANCELLED" || subscriptionStatus === "SUSPENDED") {
      return NextResponse.redirect(new URL("/subscription-required", request.url))
    }

    // Check if trial has expired
    if (
      subscriptionStatus === "TRIAL" &&
      session.user.trialEndsAt &&
      new Date() > new Date(session.user.trialEndsAt)
    ) {
      return NextResponse.redirect(new URL("/subscription-required", request.url))
    }
  }

  // Admin route protection
  if (pathname.startsWith("/admin")) {
    if (!ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.redirect(new URL("/customer/dashboard", request.url))
    }
  }

  // Customer route protection
  if (pathname.startsWith("/customer")) {
    if (!CUSTOMER_ROLES.includes(session.user.role)) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp|.*\\.ico).*)",
  ]
}
