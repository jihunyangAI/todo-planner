import { expect, test } from '@playwright/test';
import { login, openApp, quickAdd } from './helpers';

// 첫 로드 재시도(2+4+8초)와 10초 지연을 실제 시간으로 기다리므로 기본 제한 시간(30초)보다 길게 둔다
test.setTimeout(90_000);

const LIST = '**/api/tasks';

test('첫 목록 요청이 느리면 "서버에 연결하는 중"을 보여 주고 쓰기를 막는다 (AC35)', async ({ page }) => {
  await login(page);
  await page.route(LIST, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    await route.continue();
  });
  await page.goto('/#/today');
  await page.reload();
  await expect(page.getByText(/서버에 연결하는 중입니다/)).toBeVisible({ timeout: 6_000 });
  await expect(page.getByLabel('오늘 할 일 추가')).toHaveCount(0);
  await expect(page.getByLabel('오늘 할 일 추가')).toBeVisible({ timeout: 20_000 });
});

test('첫 로드가 계속 실패하면 약 14초 뒤 오류 화면과 [다시 시도]가 나온다 (AC35)', async ({ page }) => {
  await login(page);
  await page.route(LIST, (route) =>
    route.request().method() === 'GET' ? route.abort('connectionrefused') : route.continue(),
  );
  await page.goto('/#/today');
  await page.reload();
  await expect(page.getByRole('heading', { name: '서버에 연결하지 못했습니다' })).toBeVisible({ timeout: 30_000 });

  await page.unroute(LIST);
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByLabel('오늘 할 일 추가')).toBeVisible();
});

test('창이 다시 활성화될 때 받아 오기가 실패해도 배너 없이 편집 상태를 유지한다 (AC35)', async ({ page }) => {
  await openApp(page, '#/today');
  await quickAdd(page, '오늘 할 일 추가', '그대로 있을 작업');
  await page.waitForLoadState('networkidle');

  await page.route(LIST, (route) =>
    route.request().method() === 'GET' ? route.abort('connectionrefused') : route.continue(),
  );
  const refetch = page.waitForRequest((req) => req.url().endsWith('/api/tasks') && req.method() === 'GET');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await refetch;

  await expect(page.getByRole('checkbox', { name: '그대로 있을 작업' })).toBeEnabled();
  await expect(page.getByText('저장하지 못한 변경')).toHaveCount(0);
  await expect(page.getByText('서버에 연결하지 못했습니다')).toHaveCount(0);
});
