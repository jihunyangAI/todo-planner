import { expect, test } from '@playwright/test';
import { goTo, openApp, quickAdd, task, waitForSaved } from './helpers';

test('복사한 ID를 다른 브라우저에 붙여 넣으면 같은 목록이 보이고, 이전 ID로 되돌릴 수 있다 (AC19)', async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await openApp(pageA, '#/all');
  await quickAdd(pageA, '할 일 추가 (날짜 없이)', 'A 브라우저 작업');
  await waitForSaved(pageA);
  await goTo(pageA, '설정');
  const idA = await pageA.getByLabel('현재 ID').inputValue();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await openApp(pageB, '#/settings');
  const idB = await pageB.getByLabel('현재 ID').inputValue();
  expect(idB).not.toBe(idA);

  await pageB.getByLabel('다른 브라우저에서 복사한 ID로 전환').fill(`  ${idA.toUpperCase()}  `);
  await pageB.getByRole('button', { name: '전환' }).click();
  const dialog = pageB.getByRole('dialog', { name: 'ID를 바꿀까요?' });
  await expect(dialog.getByText(idB)).toBeVisible();
  await dialog.getByRole('button', { name: '전환' }).click();
  await expect(pageB.getByLabel('현재 ID')).toHaveValue(idA);

  await goTo(pageB, '전체');
  await expect(task(pageB, 'A 브라우저 작업')).toBeVisible();

  await goTo(pageB, '설정');
  await pageB.getByRole('button', { name: '이전 ID로 되돌리기' }).click();
  await pageB.getByRole('dialog').getByRole('button', { name: '전환' }).click();
  await expect(pageB.getByLabel('현재 ID')).toHaveValue(idB);
  await goTo(pageB, '전체');
  await expect(pageB.getByText('아직 할 일이 없습니다.')).toBeVisible();

  await pageB.getByRole('link', { name: '설정' }).click();
  await pageB.getByLabel('다른 브라우저에서 복사한 ID로 전환').fill('not-a-uuid');
  await pageB.getByRole('button', { name: '전환' }).click();
  await expect(pageB.getByText('UUID 형식의 ID가 아닙니다.')).toBeVisible();
  await expect(pageB.getByRole('dialog')).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});

test('한 탭에서 ID를 바꾸면 다른 탭이 목록을 다시 불러오고 알린다 (AC34)', async ({ context }) => {
  const tab1 = await context.newPage();
  await openApp(tab1, '#/all');
  await quickAdd(tab1, '할 일 추가 (날짜 없이)', '원래 ID의 작업');
  await waitForSaved(tab1);

  const tab2 = await context.newPage();
  await openApp(tab2, '#/settings');
  await tab2.getByLabel('다른 브라우저에서 복사한 ID로 전환').fill('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  await tab2.getByRole('button', { name: '전환' }).click();
  await tab2.getByRole('dialog').getByRole('button', { name: '전환' }).click();

  await expect(tab1.getByText('다른 탭에서 ID가 바뀌어 목록을 다시 불러왔습니다.')).toBeVisible();
  await expect(task(tab1, '원래 ID의 작업')).toHaveCount(0);
});

test('다른 탭에서 ID가 바뀌면 저장하지 못한 변경을 버리고 건수를 알린다 (AC34)', async ({ context }) => {
  const tab1 = await context.newPage();
  await openApp(tab1, '#/all');
  await quickAdd(tab1, '할 일 추가 (날짜 없이)', '저장 실패할 작업');
  await waitForSaved(tab1);
  const id = await task(tab1, '저장 실패할 작업').getAttribute('data-task-id');
  await tab1.route(`**/api/tasks/${id}`, (route) => route.fulfill({ status: 503, body: '{}' }));
  await tab1.getByRole('checkbox', { name: '저장 실패할 작업' }).check();
  await expect(tab1.getByText('저장하지 못한 변경 1건')).toBeVisible();

  const tab2 = await context.newPage();
  await openApp(tab2, '#/settings');
  await tab2.getByLabel('다른 브라우저에서 복사한 ID로 전환').fill('ffffffff-ffff-4fff-8fff-ffffffffffff');
  await tab2.getByRole('button', { name: '전환' }).click();
  await tab2.getByRole('dialog').getByRole('button', { name: '전환' }).click();

  await expect(tab1.getByText(/저장하지 못한 변경 1건은 버려졌습니다/)).toBeVisible();
  await expect(tab1.getByText('저장하지 못한 변경 1건', { exact: true })).toHaveCount(0);
});
