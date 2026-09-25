import { expect, test } from '@playwright/test';
import { openApp, task } from './helpers';

test('마우스 없이 키보드만으로 추가·날짜 지정·완료·삭제를 할 수 있다 (AC17)', async ({ page }) => {
  await openApp(page, '#/all');
  const kb = page.keyboard;

  // 추가: 입력란에 포커스 → 입력 → Enter
  await page.getByLabel('할 일 추가 (날짜 없이)').focus();
  await kb.type('키보드 작업');
  await kb.press('Enter');
  const item = task(page, '키보드 작업');
  await expect(item).toBeVisible();

  // 날짜 지정: [일정] 버튼 → Enter → Tab으로 [내일] → Enter
  await item.getByRole('button', { name: '키보드 작업 실행 예정일 변경' }).focus();
  await kb.press('Enter');
  await kb.press('Tab'); // 수정
  await kb.press('Tab'); // 삭제
  await kb.press('Tab'); // 오늘
  await kb.press('Tab'); // 내일
  await expect(item.getByRole('button', { name: '내일' })).toBeFocused();
  await kb.press('Enter');
  await expect(item.getByText(/^예정 /)).toBeVisible();

  // 완료: 체크박스에서 Space
  await item.getByRole('checkbox', { name: '키보드 작업' }).focus();
  await kb.press('Space');
  await expect(item.getByRole('checkbox', { name: '키보드 작업' })).toBeChecked();

  // 삭제: [삭제] → Enter → 대화상자에서 포커스는 [취소] → Tab → [삭제] → Enter
  await item.getByRole('button', { name: '키보드 작업 삭제' }).focus();
  await kb.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
  await kb.press('Tab');
  await expect(dialog.getByRole('button', { name: '삭제' })).toBeFocused();
  await kb.press('Enter');
  await expect(task(page, '키보드 작업')).toHaveCount(0);
});

test('Esc로 삭제 확인을 닫으면 작업이 남는다', async ({ page }) => {
  await openApp(page, '#/all');
  await page.getByLabel('할 일 추가 (날짜 없이)').fill('Esc 작업');
  await page.keyboard.press('Enter');
  await task(page, 'Esc 작업').getByRole('button', { name: 'Esc 작업 삭제' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(task(page, 'Esc 작업')).toBeVisible();
});

test('모든 화면에서 가로 스크롤이 생기지 않는다 (AC18)', async ({ page }) => {
  await openApp(page, '#/all');
  await page.getByLabel('할 일 추가 (날짜 없이)').fill('아주 긴 제목 '.repeat(8).trim().slice(0, 100));
  await page.keyboard.press('Enter');
  for (const hash of ['#/today', '#/all', '#/week', '#/settings']) {
    await page.goto(`/${hash}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${hash} 가로 넘침`).toBeLessThanOrEqual(0);
  }
});

test('640px 미만에서는 하단 탭 바, 이상에서는 상단 내비게이션', async ({ page }) => {
  await openApp(page, '#/today');
  const viewport = page.viewportSize()!;
  const box = (await page.getByRole('navigation', { name: '주요 화면' }).boundingBox())!;
  if (viewport.width < 640) {
    expect(box.y + box.height).toBeCloseTo(viewport.height, 0);
  } else {
    expect(box.y).toBe(0);
  }
});
