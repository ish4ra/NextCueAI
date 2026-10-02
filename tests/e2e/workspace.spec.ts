import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
const analysis = {
  summary: 'A connection settings screen.',
  problem: 'The address may be incorrect.',
  nextAction: 'Check the server address.',
  steps: ['Read the address field.', 'Correct any typing errors.'],
  caution: 'The screenshot cannot confirm server availability.',
  confidence: 'medium',
};
const image = async () => ({
  name: 'settings.png',
  mimeType: 'image/png',
  buffer: await sharp({ create: { width: 500, height: 350, channels: 3, background: '#334155' } })
    .png()
    .toBuffer(),
});
test.beforeEach(async ({ page }) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: { state: 'ready', model: 'gemma4:e2b', message: 'Your local vision model is ready.' },
    }),
  );
});
test('upload, language selection, analysis, and reset', async ({ page }) => {
  let submitted: Record<string, unknown> = {};
  await page.route('**/api/analyze', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: analysis });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'See the problem.' })).toBeVisible();
  await page.getByLabel('Choose screenshot').setInputFiles(await image());
  await expect(page.getByAltText('Your selected screenshot')).toBeVisible();
  await page.getByLabel('Response language').selectOption('si');
  await page.getByLabel('Detailed').check();
  await page.getByRole('button', { name: 'Analyze screenshot' }).click();
  await expect(page.getByText(analysis.summary)).toBeVisible();
  expect(submitted.language).toBe('si');
  expect(submitted.mode).toBe('detailed');
  await expect(page.getByRole('button', { name: 'Copy response' })).toBeVisible();
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByText('Drop your screenshot here')).toBeVisible();
  await expect(page.getByText(analysis.summary)).not.toBeVisible();
});
test('handles errors, retries, and safe text rendering', async ({ page }) => {
  let tries = 0;
  await page.route('**/api/analyze', (route) => {
    tries++;
    return route.fulfill(
      tries === 1
        ? { status: 502, json: { error: 'The model did not return a usable response.' } }
        : { json: { ...analysis, summary: '<img src=x onerror=alert(1)>' } },
    );
  });
  await page.goto('/');
  await page.getByLabel('Choose screenshot').setInputFiles(await image());
  await page.getByRole('button', { name: 'Analyze screenshot' }).click();
  await expect(page.getByRole('alert')).toContainText('usable response');
  await page.getByRole('button', { name: 'Retry analysis' }).click();
  await expect(page.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  expect(await page.locator('img[src="x"]').count()).toBe(0);
});
test('shows real setup instructions when Ollama is unavailable', async ({ page }) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: { state: 'offline', model: 'gemma4:e2b', message: 'Cannot reach Ollama.' },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Setup needed/ }).click();
  await expect(page.getByText('ollama pull gemma4:e2b', { exact: true })).toBeVisible();
});
test('is accessible and fits the viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Local AI ready/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByLabel('Choose screenshot').setInputFiles(await image());
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('pastes and drops screenshots, then removes them', async ({ page }) => {
  await page.goto('/');
  const bytes = [...(await image()).buffer];
  await page.evaluate((bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], 'pasted.png', { type: 'image/png' }));
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true }));
  }, bytes);
  await expect(page.getByAltText('Your selected screenshot')).toBeVisible();
  await page.getByRole('button', { name: 'Remove screenshot' }).click();
  await page.locator('.image-stage').evaluate((element, bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], 'dropped.png', { type: 'image/png' }));
    element.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true }));
  }, bytes);
  await expect(page.getByText('dropped.png', { exact: true })).toBeVisible();
});

test('cancels without allowing a late response to replace a newer result', async ({ page }) => {
  let releaseFirst!: () => void;
  const firstBlocked = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let calls = 0;
  await page.route('**/api/analyze', async (route) => {
    const first = ++calls === 1;
    if (first) await firstBlocked;
    await route
      .fulfill({ json: { ...analysis, summary: first ? 'Stale response' : 'Current response' } })
      .catch(() => {});
  });
  await page.goto('/');
  await page.getByLabel('Choose screenshot').setInputFiles(await image());
  await page.getByRole('button', { name: 'Analyze screenshot' }).click();
  await expect.poll(() => calls).toBe(1);
  await page.getByRole('button', { name: 'Cancel analysis' }).click();
  await page.getByRole('button', { name: 'Analyze screenshot' }).click();
  await expect(page.getByText('Current response', { exact: true })).toBeVisible();
  releaseFirst();
  await expect(page.getByText('Stale response', { exact: true })).not.toBeVisible();
});

test('copies a complete response and provides a manual fallback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/api/analyze', (route) => route.fulfill({ json: analysis }));
  await page.goto('/');
  await page.getByLabel('Choose screenshot').setInputFiles(await image());
  await page.getByRole('button', { name: 'Analyze screenshot' }).click();
  await page.getByRole('button', { name: 'Copy response' }).click();
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(analysis.steps[1]);
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: () => Promise.reject(new Error('Denied')),
    });
  });
  await page.getByRole('button', { name: 'Copied', exact: true }).click();
  await expect(page.getByText(/Clipboard access is unavailable/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy response' })).toBeVisible();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toContain(analysis.summary);
});

for (const width of [320, 768, 1440]) {
  test(`long Sinhala results and screenshot controls fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const longText =
      'තිරයේ පෙනෙන දේ සැලකිල්ලට ගන්න. '.repeat(35) + 'technical_identifier_'.repeat(30);
    await page.route('**/api/analyze', (route) =>
      route.fulfill({
        json: {
          ...analysis,
          summary: longText,
          nextAction: longText,
          steps: [longText],
          caution: longText,
        },
      }),
    );
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /Skip/ })).toBeFocused();
    await page
      .getByLabel('Choose screenshot')
      .setInputFiles({ ...(await image()), name: 'long-screenshot-filename-'.repeat(8) + '.png' });
    const remove = page.getByRole('button', { name: 'Remove screenshot' });
    const box = await remove.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await remove.click({ trial: true });
    await page.getByLabel('Response language').selectOption('si');
    await page.getByRole('button', { name: 'Analyze screenshot' }).click();
    await expect(page.locator('.result-content')).toHaveAttribute('lang', 'si');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.reload();
    await expect(page.getByText('Drop your screenshot here')).toBeVisible();
  });
}

test('setup guides a non-vision model back to a local vision model', async ({ page }) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        state: 'unsupported',
        model: 'text-only-model',
        message: 'This model cannot read images.',
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect local AI to get started' }).click();
  await expect(page.locator('#setup-panel')).toBeFocused();
  await expect(page.getByText('ollama pull gemma4:e2b', { exact: true })).toBeVisible();
  await expect(page.getByText('OLLAMA_MODEL=gemma4:e2b', { exact: true })).toBeVisible();
});
