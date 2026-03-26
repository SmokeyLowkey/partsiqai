import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import {
  seedOnboardingUser,
  cleanupOnboardingUser,
} from './helpers/seed-onboarding-user';

let credentials: { email: string; password: string; organizationId: string; userId: string };

test.describe('New admin onboarding flow', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);

  test.beforeEach(async () => {
    credentials = await seedOnboardingUser();
  });

  test.afterEach(async () => {
    await cleanupOnboardingUser();
  });

  test('completes full onboarding and reaches dashboard', async ({ page }) => {
    await loginAs(page, credentials.email, credentials.password);
    await page.waitForURL('**/onboarding/welcome', { timeout: 15_000 });
    await expect(page.getByText('Welcome to PartsIQ AI!')).toBeVisible();

    // Step 1: Verify form fields are present with defaults
    await expect(page.locator('#timezone')).toBeVisible();
    await expect(page.locator('#language')).toBeVisible();
    await expect(page.locator('#emailNotifications')).toBeChecked();

    // Submit step 1
    const [stepResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/onboarding/step')),
      page.getByRole('button', { name: /Continue/i }).click(),
    ]);
    expect(stepResponse.status()).toBe(200);

    // Step 2: Organization page
    await page.waitForURL('**/onboarding/organization', { timeout: 15_000 });
    await expect(page.getByText('Organization Setup')).toBeVisible();
    await expect(page.locator('#logo')).toBeVisible();
    await expect(page.locator('#primaryColor')).toBeVisible();

    // Complete setup
    const [completeResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/onboarding/complete')),
      page.getByRole('button', { name: /Complete Setup/i }).click(),
    ]);
    expect(completeResponse.status()).toBe(200);

    // The API now re-encodes the JWT cookie with onboardingStatus=COMPLETED.
    // The page redirects to /login, then middleware bounces to dashboard.
    await page.waitForURL('**/admin/dashboard', { timeout: 30_000 });
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('skips onboarding from welcome page and reaches dashboard', async ({ page }) => {
    await loginAs(page, credentials.email, credentials.password);
    await page.waitForURL('**/onboarding/welcome', { timeout: 15_000 });

    // Click Skip and verify API succeeds
    const [skipResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/onboarding/skip')),
      page.getByRole('button', { name: /Skip for now/i }).click(),
    ]);
    expect(skipResponse.status()).toBe(200);

    // The API now re-encodes the JWT cookie with onboardingStatus=SKIPPED.
    // The page redirects to /admin/dashboard directly.
    await page.waitForURL('**/admin/dashboard', { timeout: 30_000 });
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Getting started checklist should be visible for a new org with no data
    await expect(page.getByText('Get started with PartsIQ')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Add a supplier')).toBeVisible();
    await expect(page.getByText('Invite a team member')).toBeVisible();
  });

  test('middleware enforces onboarding redirect on protected routes', async ({ page }) => {
    await loginAs(page, credentials.email, credentials.password);
    await page.waitForURL('**/onboarding/welcome', { timeout: 15_000 });

    // Try to navigate directly to dashboard
    await page.goto('/admin/dashboard');

    // Middleware should redirect back to onboarding
    await page.waitForURL('**/onboarding/welcome', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/onboarding\/welcome/);
  });

  test('checklist items update as setup steps are completed', async ({ page }) => {
    await loginAs(page, credentials.email, credentials.password);
    await page.waitForURL('**/onboarding/welcome', { timeout: 15_000 });

    // Skip onboarding to get to dashboard
    const [skipResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/onboarding/skip')),
      page.getByRole('button', { name: /Skip for now/i }).click(),
    ]);
    expect(skipResponse.status()).toBe(200);

    await page.waitForURL('**/admin/dashboard', { timeout: 30_000 });

    // Checklist visible — all items unchecked for a fresh org
    await expect(page.getByText('Get started with PartsIQ')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('0/5 complete')).toBeVisible();

    // --- Add a supplier via API ---
    const supplierRes = await page.request.post('/api/suppliers', {
      data: {
        supplierId: 'E2E-SUP-001',
        name: 'E2E Test Supplier',
        type: 'DISTRIBUTOR',
      },
    });
    expect(supplierRes.status()).toBe(201);

    // --- Add a vehicle via API ---
    const vehicleRes = await page.request.post('/api/vehicles', {
      data: {
        vehicleId: 'E2E-VEH-001',
        serialNumber: 'SN-E2E-001',
        make: 'Caterpillar',
        model: '320F',
        year: 2024,
        type: 'EXCAVATOR',
      },
    });
    expect(vehicleRes.status()).toBe(201);

    // Reload dashboard to see updated checklist
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should now show 2/5 complete (supplier + vehicle)
    await expect(page.getByText('Get started with PartsIQ')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('2/5 complete')).toBeVisible();
  });
});
