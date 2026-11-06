import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/ja/', '/ja/udp/', '/ja/tcp/', '/ja/dns/', '/ja/tls13/', '/ja/compare/transport/', '/ja/compare/naming-security/', '/ja/websocket/', '/ja/webrtc/', '/ja/game/', '/ja/webtransport/', '/ja/compare/realtime/', '/ja/about/'];

for (const path of PAGES) {
  test(`${path}: axe で重大な違反がなく、横にはみ出さない`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

for (const scheme of ['dark', 'light'] as const) {
  test(`${scheme}: コントラストの違反がない`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/ja/webrtc/#stun');
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('キーボードだけで全手順に到達でき、ハッシュが変わる', async ({ page }) => {
  await page.goto('/ja/websocket/');
  await expect(page.getByText('手順 1 / 7')).toBeVisible();
  for (let i = 2; i <= 7; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(`手順 ${i} / 7`)).toBeVisible();
  }
  await expect(page).toHaveURL(/#close$/);
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/#ping$/);
});

test('ハッシュで手順を直接開ける', async ({ page }) => {
  await page.goto('/ja/websocket/#switching');
  await expect(page.getByRole('heading', { name: '101 Switching Protocols' })).toBeVisible();
});

test('ビット分解を開ける', async ({ page }) => {
  await page.goto('/ja/websocket/#client-text');
  const btn = page.getByRole('button', { name: 'ビットを見る' }).first();
  await btn.click();
  await expect(page.getByText('RSV1-3')).toBeVisible();
});

test('架空フォーマットと復号後の注記が出る', async ({ page }) => {
  await page.goto('/ja/game/#input');
  await expect(page.getByText(/架空フォーマット/).first()).toBeVisible();
  await page.goto('/ja/webtransport/#datagram');
  await expect(page.getByText(/復号後の姿/).first()).toBeVisible();
});

test('reduced-motion では矢印がすぐに表示される', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ja/webrtc/#checks');
  await expect(page.getByText('手順 5 / 9')).toBeVisible();
  const waiting = await page.locator('svg [class*="wait"]').count();
  expect(waiting).toBe(0);
});

test('Space で自動再生を切り替える', async ({ page }) => {
  await page.goto('/ja/websocket/');
  await page.locator('h1').click();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: '一時停止' })).toBeVisible();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: '自動再生' })).toBeVisible();
});
