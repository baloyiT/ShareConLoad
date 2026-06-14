import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SNAP_DIR = path.join('tests', 'snapshots', 'agent-onboarding');

function snap(page: Page, name: string) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  return page.screenshot({
    path: path.join(SNAP_DIR, `${name}.png`),
    fullPage: true,
  });
}

// Agent onboarding uses server actions that require auth
test.use({ storageState: 'tests/.auth/agent-user.json' });

test.describe('Agent Onboarding Flow', () => {

  test('Step 1 — Business Details page renders correctly', async ({ page }) => {
    await page.goto('/onboarding/agent');

    // Wait for form to appear (page loads auth check client-side)
    await expect(page.locator('h1')).toContainText('Tell us about your agency', { timeout: 10_000 });
    await expect(page.getByText('Step 1 of 5 — Business Details')).toBeVisible();

    // Verify all fields are present
    await expect(page.locator('input[name="business_name"]')).toBeVisible();
    await expect(page.locator('input[name="contact_person"]')).toBeVisible();
    await expect(page.locator('input[name="phone_number"]')).toBeVisible();
    await expect(page.locator('select[name="country"]')).toBeVisible();
    await expect(page.locator('input[name="years_in_operation"]')).toBeVisible();
    await expect(page.locator('input[name="operating_corridors"]').first()).toBeVisible();
    await expect(page.locator('textarea[name="service_description"]')).toBeVisible();

    await snap(page, '01-step1-empty');
  });

  test('Step 1 — fills in business details and submits', async ({ page }) => {
    await page.goto('/onboarding/agent');
    await expect(page.locator('h1')).toContainText('Tell us about your agency', { timeout: 10_000 });

    await page.locator('input[name="business_name"]').fill('Test Freight Agency');
    await page.locator('input[name="contact_person"]').fill('Jane Smith');
    await page.locator('input[name="phone_number"]').fill('+27 82 555 0100');
    await page.locator('select[name="country"]').selectOption('South Africa');
    await page.locator('input[name="years_in_operation"]').fill('5');

    // Select corridors
    await page.locator('input[value="Africa"]').check();
    await page.locator('input[value="Europe"]').check();

    await page.locator('textarea[name="service_description"]').fill(
      'Full-service freight forwarding between Southern Africa and Europe. Specialising in bulk and consolidated container loads.'
    );

    await snap(page, '02-step1-filled');

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should navigate to Step 2
    await expect(page).toHaveURL('/onboarding/agent/credentials', { timeout: 15_000 });
    await expect(page.getByText('Step 2 of 5 — Credentials')).toBeVisible();

    await snap(page, '03-step2-arrived');
  });

  test('Step 2 — Credentials page renders and fills', async ({ page }) => {
    await page.goto('/onboarding/agent/credentials');
    await expect(page.locator('h1')).toContainText('Your freight credentials', { timeout: 10_000 });

    await expect(page.locator('input[name="license_number"]')).toBeVisible();
    await expect(page.locator('input[name="license_authority"]')).toBeVisible();
    await expect(page.locator('input[name="license_expiry"]')).toBeVisible();
    await expect(page.locator('input[name="registration_number"]')).toBeVisible();

    await snap(page, '04-step2-empty');

    await page.locator('input[name="license_number"]').fill('FF-ZA-2024-00999');
    await page.locator('input[name="license_authority"]').fill('SAAFF — South Africa');
    await page.locator('input[name="license_expiry"]').fill('2027-12-31');
    await page.locator('input[name="registration_number"]').fill('2023/099999/07');

    await snap(page, '05-step2-filled');

    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/onboarding/agent/documents', { timeout: 15_000 });
    await expect(page.getByText('Step 3 of 5 — Documents')).toBeVisible();

    await snap(page, '06-step3-arrived');
  });

  test('Step 3 — Document Upload page renders', async ({ page }) => {
    await page.goto('/onboarding/agent/documents');
    await expect(page.locator('h1')).toContainText('Upload your documents', { timeout: 10_000 });

    await expect(page.getByText('Freight Forwarder License')).toBeVisible();
    await expect(page.getByText('Business Registration Certificate')).toBeVisible();
    await expect(page.getByText('Identity Document (Contact Person)')).toBeVisible();
    await expect(page.getByText('Proof of Address')).toBeVisible();

    await snap(page, '07-step3-documents');

    // Upload test PDF file (creates a minimal valid file for testing)
    const testFilePath = path.join('tests', 'fixtures', 'test-doc.pdf');
    fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
    if (!fs.existsSync(testFilePath)) {
      // Minimal PDF header — enough for a file upload test
      fs.writeFileSync(testFilePath, '%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\n%%EOF');
    }

    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(testFilePath);
    await fileInputs.nth(1).setInputFiles(testFilePath);
    await fileInputs.nth(2).setInputFiles(testFilePath);

    await snap(page, '08-step3-files-selected');
  });

  test('Step 4 — Bank Details page renders and fills', async ({ page }) => {
    await page.goto('/onboarding/agent/bank');
    await expect(page.locator('h1')).toContainText('Banking information', { timeout: 10_000 });

    await expect(page.locator('input[name="bank_name"]')).toBeVisible();
    await expect(page.locator('input[name="bank_account_holder"]')).toBeVisible();
    await expect(page.locator('input[name="bank_account_number"]')).toBeVisible();
    await expect(page.locator('input[name="bank_branch_code"]')).toBeVisible();

    await snap(page, '09-step4-empty');

    await page.locator('input[name="bank_name"]').fill('First National Bank');
    await page.locator('input[name="bank_account_holder"]').fill('Test Freight Agency Pty Ltd');
    await page.locator('input[name="bank_account_number"]').fill('62012345678');
    await page.locator('input[name="bank_branch_code"]').fill('250655');

    await snap(page, '10-step4-filled');

    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/onboarding/agent/review', { timeout: 15_000 });
    await expect(page.getByText('Step 5 of 5 — Review & Submit')).toBeVisible();

    await snap(page, '11-step5-arrived');
  });

  test('Step 5 — Review page shows summary and requires agreement', async ({ page }) => {
    await page.goto('/onboarding/agent/review');
    await expect(page.locator('h1')).toContainText('Review your application', { timeout: 10_000 });

    // Wait for profile data to load
    await page.waitForTimeout(2000);

    await snap(page, '12-step5-review');

    // Submit button should be disabled without agreement
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();

    // Check the agreement checkbox
    await page.locator('input[type="checkbox"]').check();
    await expect(submitBtn).toBeEnabled();

    await snap(page, '13-step5-agreed');
  });

  test('Status tracker page renders correctly', async ({ page }) => {
    await page.goto('/onboarding/agent/status');
    await expect(page.locator('h1')).toContainText('Application Status', { timeout: 10_000 });

    await snap(page, '14-status-tracker');
  });
});
