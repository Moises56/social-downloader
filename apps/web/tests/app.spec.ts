import { expect, type Page, test } from '@playwright/test';

test('muestra la interfaz del downloader', async ({ page }: { page: Page }) => {
  await page.goto('/');
  await expect(page.getByText('Social Downloader')).toBeVisible();
  await expect(page.getByPlaceholder('https://www.youtube.com/watch?v=...')).toBeVisible();
  await expect(page.getByRole('button', { name: /analizar/i })).toBeVisible();
});
