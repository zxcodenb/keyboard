import { test, expect, type Page } from '@playwright/test';

async function mockDesktop(page: Page) {
  await page.addInitScript(() => {
    const settings = { mode: 'solid', color: '#80e8c0', secondary: '#7e9bff', brightness: 70, speed: 45, power: true, overrides: {} };
    const data = { settings, connected: true, controlled: false, sending: false, message: '接收器已连接', presets: [] as any[] };
    (window as any).__calls = [];
    (window as any).mygo = { call: async (method: string, ...args: any[]) => {
      (window as any).__calls.push({ method, args });
      if (method === 'Keyboard.Apply') { data.settings = args[0]; data.controlled = data.sending = true; }
      if (method === 'Keyboard.Release') { data.controlled = data.sending = false; }
      if (method === 'Keyboard.SavePreset') data.presets.push({ id: 'saved-test', name: args[0], settings: args[1] });
      if (method === 'Keyboard.DeletePreset') data.presets = data.presets.filter(p => p.id !== args[0]);
      return structuredClone(data);
    } };
  });
}

test('浏览器明确标注仅预览，键帽数量与映射完整', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview-banner')).toBeVisible();
  await expect(page.locator('[data-key]')).toHaveCount(98);
  const indices = await page.locator('[data-key]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-key')));
  expect(new Set(indices).size).toBe(98);
  await expect(page.locator('[data-key="112"]')).toBeVisible();
  await expect(page.locator('#sync-status')).toContainText('预览模式');
});

test('逐键配色、全键配色与亮度能够同步', async ({ page }) => {
  await mockDesktop(page); await page.goto('/');
  await expect(page.locator('#connection-label')).toHaveText('接收器已连接');
  await page.locator('[data-key="0"]').click();
  await page.locator('[data-key="99"]').click();
  await expect(page.locator('#color-title')).toContainText('已选 2 键');
  await page.locator('[data-color="#91b8ff"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'Keyboard.Apply').at(-1)?.args[0].overrides)).toEqual({ '0': '#91b8ff', '99': '#91b8ff' });
  await page.locator('[data-scope="all"]').click();
  await page.locator('#hex-input').fill('FF8000');
  await page.locator('#hex-input').press('Tab');
  await page.locator('#brightness').fill('33');
  await expect.poll(() => page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'Keyboard.Apply').at(-1)?.args[0])).toMatchObject({ color: '#ff8000', brightness: 33, overrides: {} });
});

test('效果切换、预设保存删除、关灯与恢复', async ({ page }) => {
  await mockDesktop(page); await page.goto('/');
  await page.locator('[data-mode="wave"]').click();
  await expect(page.locator('#speed-control')).toBeVisible();
  await expect(page.locator('#secondary-control')).toBeVisible();
  await page.locator('[data-action="save"]').click();
  await page.locator('#preset-name').fill('我的薄荷灯光');
  await page.getByRole('button', { name: '保存预设', exact: true }).click();
  await expect(page.locator('#preset-dialog')).not.toBeVisible();
  await expect(page.locator('[data-preset="saved-test"]')).toContainText('我的薄荷灯光');
  await page.locator('[data-action="library"]').click();
  await expect(page.locator('.keyboard-card')).not.toBeVisible();
  await page.locator('[data-preset="saved-test"]').click();
  await expect(page.locator('.power-button')).toContainText('关闭灯光');
  await page.locator('[data-action="power"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'Keyboard.Apply').at(-1)?.args[0].power)).toBe(false);
  await page.locator('[data-action="release"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__calls.at(-1).method)).toBe('Keyboard.Release');
  await page.locator('[data-delete="saved-test"]').click();
  await expect(page.locator('[data-preset="saved-test"]')).toHaveCount(0);
});

test('最小窗口无水平溢出，键帽不重叠', async ({ page }) => {
  await mockDesktop(page); await page.setViewportSize({ width: 1020, height: 740 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.keyboard-case').evaluate(el => el.style.transform = 'none');
  const boxes = await page.locator('[data-key]').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    expect(Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1).toBe(false);
  }
});

test('控制进程报错不伪装成连接成功', async ({ page }) => {
  await page.addInitScript(() => { (window as any).mygo = { call: async () => { throw new Error('本地控制进程不可用'); } }; });
  await page.goto('/');
  await expect(page.locator('#error-banner')).toContainText('本地控制进程不可用');
  await expect(page.locator('#connection-label')).toHaveText('等待设备连接');
  await expect(page.locator('.power-button')).toBeDisabled();
});

test('设备权限失败显示授权入口，不宣称灯光已同步', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).mygo = { call: async () => ({
      settings: { mode: 'solid', color: '#80e8c0', secondary: '#7e9bff', brightness: 70, speed: 45, power: true, overrides: {} },
      connected: false, controlled: true, sending: false, presets: [], message: '接收器访问失败：请允许输入监控权限',
    }) };
  });
  await page.goto('/');
  await expect(page.locator('#permission-button')).toBeVisible();
  await expect(page.locator('#error-banner')).toContainText('输入监控');
  await expect(page.locator('#preview-label')).toHaveText('灯光效果预览');
});
