import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('should log in successfully with valid credentials and redirect to dashboard', async ({
    page,
  }) => {
    // Navigate to login page
    await page.goto('/auth/login');

    // Selectors
    const tenantInput = page.locator('#tenantCode');
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const submitBtn = page.locator('button[type="submit"]');

    // Fill the inputs (the defaults are pre-filled, but let's be explicit and clear/fill them to make the test robust)
    await tenantInput.fill('demo-clinic');
    await emailInput.fill('admin@demo.clinic');
    await passwordInput.fill('Admin123!');

    // Submit form
    await submitBtn.click();

    // Verify redirected to /dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
