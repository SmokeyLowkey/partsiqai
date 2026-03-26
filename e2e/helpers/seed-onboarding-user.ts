import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const PASSWORD = 'OnboardTest!2026';

let createdOrgId: string | null = null;
let createdUserId: string | null = null;

/**
 * Seed a pre-verified ADMIN user with onboardingStatus = NOT_STARTED.
 * Returns the credentials needed for loginAs().
 * Each call generates a unique email/slug to avoid collisions in parallel workers.
 */
export async function seedOnboardingUser() {
  const uid = randomUUID().slice(0, 8);
  const email = `e2e-onboarding-${uid}@test.local`;
  const hashedPassword = await hash(PASSWORD, 10);

  const org = await prisma.organization.create({
    data: {
      name: 'E2E Onboarding Org',
      slug: `e2e-onboarding-${uid}`,
      subscriptionTier: 'STARTER',
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      name: 'E2E Onboarding User',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true,
      emailVerified: new Date(),
      onboardingStatus: 'NOT_STARTED',
      onboardingStep: 0,
      organizationId: org.id,
    },
  });

  createdOrgId = org.id;
  createdUserId = user.id;

  return { email, password: PASSWORD, organizationId: org.id, userId: user.id };
}

/**
 * Delete the test user and organization created by seedOnboardingUser().
 */
export async function cleanupOnboardingUser() {
  try {
    if (createdOrgId) {
      // Delete org-scoped data first (foreign key order)
      await prisma.supplier.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {});
      await prisma.vehicle.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {});
      await prisma.invitation.deleteMany({ where: { organizationId: createdOrgId } }).catch(() => {});
    }
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
    if (createdOrgId) {
      await prisma.organization.delete({ where: { id: createdOrgId } }).catch(() => {});
    }
  } finally {
    createdOrgId = null;
    createdUserId = null;
    await prisma.$disconnect();
  }
}
