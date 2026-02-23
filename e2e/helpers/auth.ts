import { type Page } from '@playwright/test';

/**
 * Log in via the NextAuth credentials form.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  // Wait for redirect away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15_000,
  });
}
