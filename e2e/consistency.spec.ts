import { expect, test } from '@playwright/test';
import { goTo, openApp, quickAdd, task } from './helpers';

test('한 화면에서 수정한 내용이 다른 두 화면에 바로 반영된다 (AC21, PRD.md:68)', async ({ page }) => {
  await openApp(page, '#/today');
  await quickAdd(page, '오늘 할 일 추가', '원래 제목');

  await goTo(page, '전체');
  await task(page, '원래 제목').getByRole('button', { name: '원래 제목 수정' }).click();
  const dialog = page.getByRole('dialog', { name: '할 일 수정' });
  await dialog.getByLabel('제목 (필수)').fill('바뀐 제목');
  await dialog.getByLabel('우선순위').selectOption('high');
  await dialog.getByRole('button', { name: '저장' }).click();

  await goTo(page, '오늘');
  await expect(task(page, '바뀐 제목')).toBeVisible();
  await expect(task(page, '바뀐 제목').getByText('높음')).toBeVisible();

  await goTo(page, '주간');
  await expect(page.locator('.week-day--today').getByText('바뀐 제목')).toBeVisible();

  // 주간에서 완료하면 오늘·전체에도 반영된다
  await page.getByRole('checkbox', { name: '바뀐 제목' }).check();
  await goTo(page, '오늘');
  await expect(page.getByRole('checkbox', { name: '바뀐 제목' })).toBeChecked();
  await goTo(page, '전체');
  await expect(page.getByRole('checkbox', { name: '바뀐 제목' })).toBeChecked();
});
