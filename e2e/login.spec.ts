import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'password123';

test.describe('Login page', () => {
  test('should display the login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('bad@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Should stay on login page and show some error indication
    await expect(page).toHaveURL(/login/);
    // Check for error text (toast, alert, or inline)
    const errorVisible = await page
      .locator('[role="alert"], .text-red-500, .text-destructive, [data-testid="login-error"]')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    expect(errorVisible || page.url().includes('error')).toBeTruthy();
  });

  test('should redirect to dashboard on successful login', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Should navigate away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15_000,
    });

    expect(page.url()).not.toContain('/login');
  });

  test('should redirect authenticated user away from /login', async ({ page }) => {
    // First log in
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15_000,
    });

    // Now revisit /login — should redirect
    await page.goto('/login');
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10_000,
    });

    expect(page.url()).not.toContain('/login');
  });
});
