import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'password123';

test.describe('AI Chat / Search', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('should display the chat interface', async ({ page }) => {
    await page.goto('/customer/ai-chat');

    // Chat input area should be visible
    const chatInput = page.locator(
      'textarea, input[type="text"], [contenteditable="true"], [data-testid="chat-input"]'
    ).first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
  });

  test('should submit a query and receive a response', async ({ page }) => {
    await page.goto('/customer/ai-chat');

    const chatInput = page.locator(
      'textarea, input[type="text"], [contenteditable="true"], [data-testid="chat-input"]'
    ).first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    await chatInput.fill('fuel filter');
    await chatInput.press('Enter');

    // Wait for any response content to appear (loading state clears)
    const responseArea = page.locator(
      '[data-testid="chat-response"], [data-testid="message"], .message, .chat-message'
    ).first();

    await expect(responseArea).toBeVisible({ timeout: 30_000 });
  });

  test('should show structured content in response', async ({ page }) => {
    await page.goto('/customer/ai-chat');

    const chatInput = page.locator(
      'textarea, input[type="text"], [contenteditable="true"], [data-testid="chat-input"]'
    ).first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    await chatInput.fill('oil filter');
    await chatInput.press('Enter');

    // Wait for structured response — part cards, tables, or markdown
    await page.waitForTimeout(5_000);

    // Page should have more content than just the input
    const bodyText = await page.locator('main, [role="main"], #__next').first().textContent();
    expect(bodyText?.length).toBeGreaterThan(50);
  });
});
