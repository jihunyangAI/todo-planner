import { expect, type Page } from '@playwright/test';

/** 목록을 받아 와서 쓰기가 가능한 상태가 될 때까지 기다린다. */
export async function openApp(page: Page, hash = '#/today') {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('navigation', { name: '주요 화면' })).toBeVisible();
  if (!hash.startsWith('#/settings')) {
    await expect(page.getByText('불러오는 중…')).toHaveCount(0);
  }
}

export async function quickAdd(page: Page, label: string, title: string) {
  const input = page.getByLabel(label);
  await input.fill(title);
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: title })).toBeVisible();
}

export function task(page: Page, title: string) {
  return page.locator('li.task', { has: page.getByRole('checkbox', { name: title, exact: true }) });
}

/** 저장 요청이 모두 끝날 때까지 기다린다(새로고침 전에 사용). */
export async function waitForSaved(page: Page) {
  await page.waitForLoadState('networkidle');
}

export async function goTo(page: Page, name: '오늘' | '전체' | '주간' | '설정') {
  await page.getByRole('navigation', { name: '주요 화면' }).getByRole('link', { name }).click();
}
