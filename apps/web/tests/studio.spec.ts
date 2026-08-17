/**
 * Studio E2E Tests
 *
 * Tests the main Studio workflow with Playwright.
 * Uses a small fixture video for upload.
 *
 * Requires: API running on :3005, Web on :4200
 * Run: npx playwright test tests/studio.spec.ts
 */

import { expect, test, type Page } from '@playwright/test';
import { join } from 'path';

const STUDIO_URL = '/studio';
const FIXTURE_VIDEO = join(__dirname, 'fixtures/test-video.mp4');
const FIXTURE_MUSIC = join(__dirname, 'fixtures/test-music.mp3');

const uploadVideo = async (page: Page) => {
  await page.locator('input[type="file"][accept="video/*"]').setInputFiles(FIXTURE_VIDEO);
  await expect(page.locator('.preview-wrapper video')).toBeVisible({ timeout: 10000 });
};

test.describe('Studio', () => {
  test.describe('Main Flow', () => {
    test('opens studio and shows upload zone', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await expect(page.locator('.studio-header h1')).toHaveText('Studio');
      await expect(page.locator('.preview-column .upload-zone')).toBeVisible();
      await expect(page.locator('.preview-column .upload-title')).toHaveText('Sube un video');
    });

    test('loads presets from API', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);

      await expect(page.locator('.brand-btn').first()).toBeVisible({ timeout: 5000 });

      const brandCount = await page.locator('.brand-btn').count();
      expect(brandCount).toBeGreaterThan(0);

      const compCount = await page.locator('.chip-btn').count();
      expect(compCount).toBeGreaterThan(0);

      const textCount = await page.locator('.text-chip').count();
      expect(textCount).toBeGreaterThan(0);

      const exportCount = await page.locator('.export-btn').count();
      expect(exportCount).toBeGreaterThan(0);
    });

    test('upload video and show preview', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);
      await expect(page.locator('.timeline-wrapper')).toBeVisible();
    });

    test('select brand preset', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);

      const firstBrand = page.locator('.brand-btn').first();
      await firstBrand.click();
      await expect(firstBrand).toHaveClass(/active/);
      await expect(page.locator('.brand-signature')).toBeVisible();
    });

    test('add text overlay', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);

      await page.locator('.text-add .text-field').fill('Test overlay text');
      await page.locator('.text-add .btn-primary').click();

      await expect(page.locator('.text-item')).toBeVisible();
      await expect(page.locator('.text-item-label')).toContainText('Test overlay text');
    });

    test('fit mode selector works', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);

      await expect(page.locator('.fit-btn').first()).toHaveClass(/active/);

      await page.locator('.fit-btn').nth(1).click();
      await expect(page.locator('.fit-btn').nth(1)).toHaveClass(/active/);
      await expect(page.locator('.fit-btn').first()).not.toHaveClass(/active/);

      await page.locator('.fit-btn').nth(2).click();
      await expect(page.locator('.fit-btn').nth(2)).toHaveClass(/active/);
      await expect(page.locator('.color-input')).toBeVisible();
    });

    test('export preset selection', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);

      await expect(page.locator('.export-btn').first()).toHaveClass(/active/);

      await page.locator('.export-btn').nth(1).click();
      await expect(page.locator('.export-btn').nth(1)).toHaveClass(/active/);
    });

    test('render button is disabled without video', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await expect(page.locator('.render-btn')).toBeDisabled();
    });

    test('render button enables after video upload', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);
      await page.waitForTimeout(500);
      await expect(page.locator('.render-btn')).toBeEnabled();
    });

    test('main render flow', async ({ page }: { page: Page }) => {
      test.setTimeout(90000);

      await page.goto(STUDIO_URL);
      await uploadVideo(page);

      await page.locator('.brand-btn').first().click();
      await expect(page.locator('.brand-signature')).toBeVisible();

      await page.locator('.text-add .text-field').fill('TEST TEXT');
      await page.locator('.text-add .btn-primary').click();
      await expect(page.locator('.text-item')).toBeVisible();

      await expect(page.locator('.export-btn').first()).toHaveClass(/active/);

      await page.waitForTimeout(500);
      await page.locator('.render-btn').click();

      await expect(page.locator('.render-spinner')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.progress-track')).toBeVisible();

      await expect(page.locator('.result-success')).toBeVisible({ timeout: 60000 });
      await expect(page.locator('.download-btn, .result-actions a')).toBeVisible();
    });
  });

  test.describe('Cancel Render', () => {
    test('cancel render stops progress', async ({ page }: { page: Page }) => {
      test.setTimeout(30000);

      await page.goto(STUDIO_URL);
      await uploadVideo(page);
      await page.locator('.brand-btn').first().click();

      await page.waitForTimeout(500);
      await page.locator('.render-btn').click();

      await expect(page.locator('.progress-track')).toBeVisible({ timeout: 5000 });

      const cancelBtn = page.locator('.btn-danger');
      if (await cancelBtn.isVisible({ timeout: 500 })) {
        await cancelBtn.click();
      }

      const cancelledOrCompleted = page.locator('.result-cancelled, .result-success');
      await expect(cancelledOrCompleted).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Saved Presets', () => {
    test('save and load composition preset', async ({ page }: { page: Page }) => {
      test.setTimeout(90000);

      await page.goto(STUDIO_URL);
      await uploadVideo(page);

      await page.locator('.text-add .text-field').fill('Preset test');
      await page.locator('.text-add .btn-primary').click();

      await page.waitForTimeout(500);
      await page.locator('.render-btn').click();
      await expect(page.locator('.result-success')).toBeVisible({ timeout: 60000 });

      await page.locator('button:has-text("Guardar preset")').click();
      await page.locator('.save-form .text-field').fill('My Preset');
      await page.locator('.save-form .btn-primary').click();

      await expect(page.locator('.saved-btn:has-text("My Preset")').first()).toBeVisible();
    });
  });

  test.describe('Real Case: Ilusiones & Colores Devotional', () => {
    test('full editorial flow with composition preset', async ({ page }: { page: Page }) => {
      test.setTimeout(120000);

      await page.goto(STUDIO_URL);

      // Step 1: Upload video
      await uploadVideo(page);
      await expect(page.locator('.timeline-wrapper')).toBeVisible();

      // Step 2: Select "Ilusiones & Colores — Devotional" composition preset
      const devotionalPreset = page.locator('.chip-btn:has-text("Devotional")').first();
      await expect(devotionalPreset).toBeVisible({ timeout: 5000 });
      await devotionalPreset.click();

      // Step 3: Verify text overlays appear (4 text items + brand handled separately)
      const textItems = page.locator('.text-item');
      await expect(textItems.first()).toBeVisible({ timeout: 5000 });
      const textCount = await textItems.count();
      expect(textCount).toBeGreaterThanOrEqual(3);

      // Step 4: Select brand preset
      const brandBtn = page.locator('.brand-btn').first();
      await brandBtn.click();
      await expect(brandBtn).toHaveClass(/active/);
      await expect(page.locator('.brand-signature')).toBeVisible();

      // Step 5: Upload music
      const musicInput = page.locator('input[type="file"][accept="audio/*"]').first();
      await musicInput.setInputFiles(FIXTURE_MUSIC);
      await page.waitForTimeout(1000);

      // Step 6: Verify export preset is selected (TikTok default)
      await expect(page.locator('.export-btn').first()).toHaveClass(/active/);

      // Step 7: Render
      await page.waitForTimeout(500);
      await expect(page.locator('.render-btn')).toBeEnabled();
      await page.locator('.render-btn').click();

      // Step 8: Wait for render progress
      await expect(page.locator('.progress-track')).toBeVisible({ timeout: 5000 });

      // Step 9: Wait for success
      await expect(page.locator('.result-success')).toBeVisible({ timeout: 90000 });

      // Step 10: Verify download link exists
      const downloadLink = page.locator('.download-btn, .result-actions a').first();
      await expect(downloadLink).toBeVisible();
      const href = await downloadLink.getAttribute('href');
      expect(href).toContain('/api/studio/renders/');
      expect(href).toContain('/download');
    });
  });
});
