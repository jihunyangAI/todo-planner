import { expect, test } from '@playwright/test';
import { goTo, login, openApp, quickAdd, task, waitForSaved } from './helpers';

test('추가 → 날짜 지정 → 완료 → 새로고침 뒤 상태 유지 (AC12, PRD.md:67)', async ({ page }) => {
  await openApp(page, '#/all');
  await quickAdd(page, '할 일 추가 (날짜 없이)', '보고서 쓰기');

  // 날짜 없이 등록한 작업은 '미계획' 필터에 나온다 (AC3)
  await page.getByLabel('미계획만').check();
  await expect(task(page, '보고서 쓰기')).toBeVisible();
  await page.getByLabel('미계획만').uncheck();

  await task(page, '보고서 쓰기').getByRole('button', { name: '보고서 쓰기 실행 예정일 변경' }).click();
  await task(page, '보고서 쓰기').getByRole('button', { name: '오늘', exact: true }).click();

  await goTo(page, '오늘');
  await expect(page.getByTestId('progress-오늘 진행률')).toHaveText('0/1 완료 (0%)');
  await page.getByRole('checkbox', { name: '보고서 쓰기' }).check();
  await expect(page.getByTestId('progress-오늘 진행률')).toHaveText('1/1 완료 (100%)');

  await waitForSaved(page);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: '보고서 쓰기' })).toBeChecked();
  await expect(page.getByTestId('progress-오늘 진행률')).toHaveText('1/1 완료 (100%)');
});

test('삭제 확인에서 취소하면 남고, 확인하면 새로고침 뒤에도 사라진다 (AC11)', async ({ page }) => {
  await openApp(page, '#/all');
  await quickAdd(page, '할 일 추가 (날짜 없이)', '지울 작업');

  await page.getByRole('button', { name: '지울 작업 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
  await expect(task(page, '지울 작업')).toBeVisible();

  await page.getByRole('button', { name: '지울 작업 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click();
  await expect(task(page, '지울 작업')).toHaveCount(0);

  await waitForSaved(page);
  await page.reload();
  await expect(page.getByText('아직 할 일이 없습니다.')).toBeVisible();
});

test('첫 화면은 오늘이고, 쿼리가 붙은 주소는 필터가 적용된 채 열린다 (AC23)', async ({ page }) => {
  await login(page);
  await page.goto('/');
  await expect(page).toHaveURL(/#\/today$/);
  await expect(page.getByRole('heading', { name: '오늘', level: 1 })).toBeVisible();

  await page.goto('/#/nowhere');
  await expect(page).toHaveURL(/#\/today$/);

  await page.goto('/#/all?status=done');
  await expect(page.getByRole('heading', { name: '전체 할 일' })).toBeVisible();
  await expect(page.getByLabel('상태')).toHaveValue('done');
});
