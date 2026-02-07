import { DefaultSession } from "next-auth"
import { UserRole, SubscriptionStatus, OnboardingStatus } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      organizationId: string
      subscriptionStatus: SubscriptionStatus
      isEmailVerified: boolean
      onboardingStatus: OnboardingStatus
      mustChangePassword: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    role: UserRole
    organizationId: string
    subscriptionStatus: SubscriptionStatus
    isEmailVerified: boolean
    onboardingStatus: OnboardingStatus
    mustChangePassword: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    organizationId: string
    subscriptionStatus: SubscriptionStatus
    isEmailVerified: boolean
    onboardingStatus: OnboardingStatus
    mustChangePassword: boolean
  }
}
