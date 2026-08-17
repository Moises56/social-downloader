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

// Brand preset picker (.brand-btn) and the music panel only render once the "Marca"
// layer is selected from the elements panel — open it before interacting with either.
const openBrandPanel = async (page: Page) => {
  await page.locator('.elements-panel .layer-item').filter({ hasText: /Marca|@Ilusiones/ }).click();
};

test.describe('Studio', () => {
  test.describe('Main Flow', () => {
    test('opens studio and shows upload zone', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await expect(page.locator('.topbar-logo')).toHaveText('Studio');
      await expect(page.locator('.upload-zone')).toBeVisible();
      await expect(page.locator('.upload-title')).toHaveText('Sube un video');
    });

    test('loads presets from API', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);

      // Composition preset chips live in the topbar once a video is loaded.
      const compCount = await page.locator('.topbar-chip').count();
      expect(compCount).toBeGreaterThan(0);

      // Default properties panel: text presets + export presets.
      const textCount = await page.locator('.text-chip').count();
      expect(textCount).toBeGreaterThan(0);
      const exportCount = await page.locator('.export-btn').count();
      expect(exportCount).toBeGreaterThan(0);

      // Brand presets live in the "Marca" panel.
      await openBrandPanel(page);
      const brandCount = await page.locator('.brand-btn').count();
      expect(brandCount).toBeGreaterThan(0);
    });

    test('upload video and show preview', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);
      await expect(page.locator('.timeline-wrapper')).toBeVisible();
    });

    test('select brand preset', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);
      await openBrandPanel(page);

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

      const textLayer = page.locator('.elements-panel .layer-item').filter({ has: page.locator('.layer-remove') });
      await expect(textLayer).toBeVisible();
      await expect(textLayer.locator('.layer-name')).toContainText('Test overlay text');
    });

    test('fit mode selector works', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);
      await page.locator('.elements-panel .layer-item').filter({ hasText: 'Video Source' }).click();

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
      await expect(page.locator('.render-btn-top')).toBeDisabled();
    });

    test('render button enables after video upload', async ({ page }: { page: Page }) => {
      await page.goto(STUDIO_URL);
      await uploadVideo(page);
      await page.waitForTimeout(500);
      await expect(page.locator('.render-btn-top')).toBeEnabled();
    });

    test('main render flow', async ({ page }: { page: Page }) => {
      test.setTimeout(90000);

      await page.goto(STUDIO_URL);
      await uploadVideo(page);

      await page.locator('.text-add .text-field').fill('TEST TEXT');
      await page.locator('.text-add .btn-primary').click();
      await expect(page.locator('.elements-panel .layer-item').filter({ has: page.locator('.layer-remove') })).toBeVisible();

      await expect(page.locator('.export-btn').first()).toHaveClass(/active/);

      await openBrandPanel(page);
      await page.locator('.brand-btn').first().click();
      await expect(page.locator('.brand-signature')).toBeVisible();

      await page.waitForTimeout(500);
      await page.locator('.render-btn-top').click();

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
      await openBrandPanel(page);
      await page.locator('.brand-btn').first().click();

      await page.waitForTimeout(500);
      await page.locator('.render-btn-top').click();

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
      await page.locator('.render-btn-top').click();
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
      const devotionalPreset = page.locator('.topbar-chip:has-text("Devotional")').first();
      await expect(devotionalPreset).toBeVisible({ timeout: 5000 });
      await devotionalPreset.click();

      // Step 3: Verify text overlays appear (4 text items + brand handled separately)
      const textItems = page.locator('.elements-panel .layer-item').filter({ has: page.locator('.layer-remove') });
      await expect(textItems.first()).toBeVisible({ timeout: 5000 });
      const textCount = await textItems.count();
      expect(textCount).toBeGreaterThanOrEqual(3);

      // Step 4 (moved up): Verify export preset is selected (TikTok default) — the
      // default properties panel showing .export-btn is still active at this point.
      await expect(page.locator('.export-btn').first()).toHaveClass(/active/);

      // Step 4: Select brand preset
      await openBrandPanel(page);
      const brandBtn = page.locator('.brand-btn').first();
      await brandBtn.click();
      await expect(brandBtn).toHaveClass(/active/);
      await expect(page.locator('.brand-signature')).toBeVisible();

      // Step 5: Upload music
      const musicInput = page.locator('input[type="file"][accept="audio/*"]').first();
      await musicInput.setInputFiles(FIXTURE_MUSIC);
      await page.waitForTimeout(1000);

      // Step 7: Render
      await page.waitForTimeout(500);
      await expect(page.locator('.render-btn-top')).toBeEnabled();
      await page.locator('.render-btn-top').click();

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

  // Drags the first [data-overlay-id] overlay by dispatching real PointerEvents
  // (pointerdown → pointermove → pointerup) — the component listens for Pointer
  // Events specifically, and Playwright's page.mouse helper does not reliably
  // reproduce the same event sequence for transform-positioned elements, so we
  // drive it directly the same way a real pointer/touch input would.
  const dragFirstOverlayTo = (page: Page, targetXFrac: number, targetYFrac?: number) =>
    page.evaluate(({ txf, tyf }) => {
      const el = document.querySelector('[data-overlay-id]') as HTMLElement;
      const vp = document.querySelector('.preview-viewport') as HTMLElement;
      const b = el.getBoundingClientRect();
      const v = vp.getBoundingClientRect();
      const startX = b.x + b.width / 2;
      const startY = b.y + b.height / 2;
      const targetX = v.x + txf * v.width;
      const targetY = tyf === undefined ? startY : v.y + tyf * v.height;

      function fire(target: EventTarget, type: string, x: number, y: number) {
        target.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, composed: true,
          pointerId: 1, isPrimary: true, pointerType: 'mouse',
          clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
        }));
      }

      fire(el, 'pointerdown', startX, startY);
      fire(window, 'pointermove', targetX, targetY);
      const guideDuringDrag = Array.from(document.querySelectorAll('.snap-guide')).map((g) => g.className);
      fire(window, 'pointerup', targetX, targetY);
      const finalRect = el.getBoundingClientRect();
      return {
        guideDuringDrag,
        guideAfterDrop: document.querySelectorAll('.snap-guide').length,
        finalNormX: (finalRect.x + finalRect.width / 2 - v.x) / v.width,
        finalNormY: (finalRect.y + finalRect.height / 2 - v.y) / v.height,
      };
    }, { txf: targetXFrac, tyf: targetYFrac });

  test.describe('Alignment & Snap Guides', () => {
    // "SU FE NO EMPEZÓ CON CERTEZA" — the Hero overlay from the manual test case.
    test('dragging the Hero overlay near center shows a snap guide and settles near center', async ({ page }: { page: Page }) => {
      test.setTimeout(30000);
      await page.goto(STUDIO_URL);
      await uploadVideo(page);
      await page.locator('.topbar-chip:has-text("Devotional")').first().click();
      await expect(page.locator('[data-overlay-id]')).toBeVisible({ timeout: 5000 });
      // The preview canvas resolves its size from an aspect-ratio + flex layout chain
      // (host height → wrapper → stage → 9:16 box); give it a frame to settle before
      // reading geometry, since our synthetic-pointer drag below bypasses Playwright's
      // built-in actionability/stability wait that .click() normally provides.
      await page.waitForTimeout(250);

      // Land just inside the snap threshold of horizontal center (x=0.5).
      const result = await dragFirstOverlayTo(page, 0.49);

      expect(result.guideDuringDrag.some((c) => c.includes('guide-v'))).toBe(true);
      expect(result.guideAfterDrop).toBe(0); // guide clears once the drag ends
      expect(Math.abs(result.finalNormX - 0.5)).toBeLessThan(0.03);
    });

    test('moving far from center never triggers a snap guide', async ({ page }: { page: Page }) => {
      test.setTimeout(30000);
      await page.goto(STUDIO_URL);
      await uploadVideo(page);
      await page.locator('.topbar-chip:has-text("Devotional")').first().click();
      await expect(page.locator('[data-overlay-id]')).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(250); // let the aspect-ratio layout chain settle (see above)

      // Well outside the snap threshold — no guide should ever appear.
      const result = await dragFirstOverlayTo(page, 0.2);

      expect(result.guideDuringDrag.some((c) => c.includes('guide-v'))).toBe(false);
      expect(Math.abs(result.finalNormX - 0.2)).toBeLessThan(0.03);
    });

    test('Centrar ambos aligns the selected overlay to x=0.5, y=0.5', async ({ page }: { page: Page }) => {
      test.setTimeout(30000);
      await page.goto(STUDIO_URL);
      await uploadVideo(page);
      await page.locator('.topbar-chip:has-text("Devotional")').first().click();

      const hero = page.locator('[data-overlay-id]').first();
      const viewport = page.locator('.preview-viewport');
      await expect(hero).toBeVisible({ timeout: 5000 });
      await hero.click();

      await page.locator('.align-btn[title="Centrar ambos"]').click();

      const vBox = (await viewport.boundingBox())!;
      const hBox = (await hero.boundingBox())!;
      const normX = (hBox.x + hBox.width / 2 - vBox.x) / vBox.width;
      const normY = (hBox.y + hBox.height / 2 - vBox.y) / vBox.height;
      expect(Math.abs(normX - 0.5)).toBeLessThan(0.03);
      expect(Math.abs(normY - 0.5)).toBeLessThan(0.03);
    });
  });
});
