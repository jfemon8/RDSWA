import { test, expect } from '@playwright/test';

test.describe('Auth flows', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    // The page should have a visible heading or main content area
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    // Navbar should be present
    await expect(page.locator('nav').first()).toBeVisible();
  });

  test('login page renders with form fields', async ({ page }) => {
    await page.goto('/login');
    // Should have email/username and password fields
    await expect(
      page.getByPlaceholder(/email/i).or(page.getByLabel(/email/i)).first()
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/password/i).or(page.getByLabel(/password/i)).first()
    ).toBeVisible();
    // Should have a submit/login button
    await expect(
      page.getByRole('button', { name: /log\s*in|sign\s*in|submit/i })
    ).toBeVisible();
  });

  test('register page renders with form fields', async ({ page }) => {
    await page.goto('/register');
    // Should have name, email, and password fields at minimum
    await expect(
      page.getByPlaceholder(/name/i).or(page.getByLabel(/name/i)).first()
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/email/i).or(page.getByLabel(/email/i)).first()
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/password/i).or(page.getByLabel(/password/i)).first()
    ).toBeVisible();
    // Should have a submit/register button
    await expect(
      page.getByRole('button', { name: /register|sign\s*up|create|submit/i })
    ).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    const emailField = page
      .getByPlaceholder(/email/i)
      .or(page.getByLabel(/email/i))
      .first();
    const passwordField = page
      .getByPlaceholder(/password/i)
      .or(page.getByLabel(/password/i))
      .first();

    await emailField.fill('nonexistent@example.com');
    await passwordField.fill('WrongPassword123!');

    // Submit the form
    await page
      .getByRole('button', { name: /log\s*in|sign\s*in|submit/i })
      .click();

    // Should show an error message (toast, alert, or inline error)
    await expect(
      page
        .getByRole('alert')
        .or(page.locator('[data-testid="error-message"]'))
        .or(page.locator('.toast, [role="status"]'))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('navigate between login and register', async ({ page }) => {
    // Start on login page
    await page.goto('/login');

    // Click link to register
    const registerLink = page.getByRole('link', {
      name: /register|sign\s*up|create.*account/i,
    });
    await expect(registerLink).toBeVisible();
    await registerLink.click();

    // Should be on register page
    await expect(page).toHaveURL(/\/register/);

    // Click link back to login
    const loginLink = page.getByRole('link', {
      name: /log\s*in|sign\s*in|already.*account/i,
    });
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    // Should be back on login page
    await expect(page).toHaveURL(/\/login/);
  });
});
