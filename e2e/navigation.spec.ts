import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('navbar is visible on home page', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('navigate to about page', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveURL(/\/about/);
    // Page should render content (not be blank)
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('navigate to events page', async ({ page }) => {
    await page.goto('/events');
    await expect(page).toHaveURL(/\/events/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('navigate to notices page', async ({ page }) => {
    await page.goto('/notices');
    await expect(page).toHaveURL(/\/notices/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('unknown route shows 404 page', async ({ page }) => {
    await page.goto('/this-route-definitely-does-not-exist');
    // Should show some indication of 404 / not found
    await expect(
      page
        .getByText(/404|not found|page.*not.*found|doesn.*exist/i)
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
