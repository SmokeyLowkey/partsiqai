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

export async function middleware(request: NextRequest) {
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
  ]

  if (
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/")
  ) {
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
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ]
}
