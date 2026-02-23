import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.E2E_TEST_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_PASSWORD || 'password123';

test.describe('Quote Requests List', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test('should display the quote requests list page', async ({ page }) => {
    await page.goto('/customer/quote-requests');

    // Should show a heading or table related to quotes
    const heading = page.locator('h1, h2, [data-testid="page-title"]').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toMatch(/quote|request/);
  });

  test('should have a status filter control', async ({ page }) => {
    await page.goto('/customer/quote-requests');

    // Look for a dropdown, select, or filter component
    const filter = page.locator(
      'select, [role="combobox"], [data-testid="status-filter"], button:has-text("Status"), button:has-text("Filter")'
    ).first();

    await expect(filter).toBeVisible({ timeout: 10_000 });
  });

  test('should navigate to quote detail on row click', async ({ page }) => {
    await page.goto('/customer/quote-requests');

    // Wait for table rows or list items to load
    const row = page.locator(
      'table tbody tr, [data-testid="quote-row"], a[href*="quote-requests/"]'
    ).first();

    // If there are quotes, click the first one
    const hasRows = await row.isVisible({ timeout: 10_000 }).catch(() => false);
    if (hasRows) {
      await row.click();
      await page.waitForURL(/quote-requests\/[a-zA-Z0-9_-]+/, { timeout: 10_000 });
      expect(page.url()).toMatch(/quote-requests\/[a-zA-Z0-9_-]+/);
    } else {
      // No quotes — page should show empty state instead of crashing
      const emptyState = page.locator(
        '[data-testid="empty-state"], .text-muted-foreground, p'
      ).first();
      await expect(emptyState).toBeVisible();
    }
  });
});
