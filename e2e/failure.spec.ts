import { expect, test } from '@playwright/test';
import { openApp, quickAdd, task, waitForSaved } from './helpers';

test('저장이 실패하면 그 작업만 되돌리고 잠근다. [다시 시도]로 반영된다 (AC13)', async ({ page }) => {
  await openApp(page, '#/today');
  await quickAdd(page, '오늘 할 일 추가', '실패할 작업');
  await quickAdd(page, '오늘 할 일 추가', '성공할 작업');
  await waitForSaved(page);

  // '실패할 작업'의 PATCH만 500을 돌려준다
  const failing = await task(page, '실패할 작업').getAttribute('data-task-id');
  await page.route(`**/api/tasks/${failing}`, (route) =>
    route.request().method() === 'PATCH' ? route.fulfill({ status: 500, body: '{}' }) : route.continue(),
  );
  await page.getByRole('checkbox', { name: '실패할 작업' }).check();
  await page.getByRole('checkbox', { name: '성공할 작업' }).check();

  await expect(page.getByRole('alert').filter({ hasText: '저장하지 못한 변경 1건' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '실패할 작업' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: '실패할 작업' })).toBeDisabled();
  await expect(task(page, '실패할 작업').getByText('저장 실패')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '성공할 작업' })).toBeChecked();

  await page.unroute(`**/api/tasks/${failing}`);
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('checkbox', { name: '실패할 작업' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '실패할 작업' })).toBeEnabled();
  await expect(page.getByText('저장하지 못한 변경')).toHaveCount(0);

  await waitForSaved(page);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: '실패할 작업' })).toBeChecked();
});

test('[버리기]는 목록을 다시 받아 서버의 실제 값을 보여 준다 (AC13)', async ({ page }) => {
  await openApp(page, '#/today');
  await quickAdd(page, '오늘 할 일 추가', '버릴 변경');
  await waitForSaved(page);
  const id = await task(page, '버릴 변경').getAttribute('data-task-id');
  // 시간 초과처럼: 서버에는 실제로 저장되지만 응답은 실패로 돌아온다
  await page.route(`**/api/tasks/${id}`, async (route) => {
    await route.fetch();
    await route.fulfill({ status: 503, body: '{}' });
  });
  await page.getByRole('checkbox', { name: '버릴 변경' }).check();
  await expect(page.getByText('저장하지 못한 변경 1건')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '버릴 변경' })).not.toBeChecked(); // 확정 상태로 되돌아감

  await page.unroute(`**/api/tasks/${id}`);
  await page.getByRole('button', { name: '버리기' }).click();
  await expect(page.getByText('저장하지 못한 변경')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: '버릴 변경' })).toBeChecked(); // 서버의 실제 값
  await expect(page.getByRole('checkbox', { name: '버릴 변경' })).toBeEnabled();
});

test('다른 곳에서 삭제된 작업을 수정하면 목록에서 사라지고 알린다 (AC31)', async ({ page }) => {
  await openApp(page, '#/today');
  await quickAdd(page, '오늘 할 일 추가', '사라질 작업');
  await waitForSaved(page);
  const id = await task(page, '사라질 작업').getAttribute('data-task-id');
  await page.route(`**/api/tasks/${id}`, (route) => route.fulfill({ status: 404, body: '{}' }));
  await page.getByRole('checkbox', { name: '사라질 작업' }).check();
  await expect(page.getByText('다른 곳에서 삭제된 작업입니다')).toBeVisible();
  await expect(task(page, '사라질 작업')).toHaveCount(0);
});
