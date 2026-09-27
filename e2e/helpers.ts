import { expect, type Page } from '@playwright/test';

let seq = 0;

/** 테스트마다 다른 GitHub 사용자 이름(같은 메모리 DB를 공유하므로 데이터가 섞이지 않게) */
export function uniqueUser(prefix = 'user'): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/** 가짜 GitHub 로그인 화면을 거쳐 로그인한다. 로그인 뒤 앱 첫 화면(/)으로 돌아온다. */
export async function login(page: Page, username = uniqueUser()): Promise<string> {
  await page.goto('/auth/github');
  await expect(page.getByRole('heading', { name: '가짜 GitHub 로그인' })).toBeVisible();
  await page.getByLabel('GitHub 사용자 이름').fill(username);
  await page.getByRole('button', { name: 'Authorize' }).click();
  await expect(page.getByRole('navigation', { name: '주요 화면' })).toBeVisible();
  return username;
}

/** 새 사용자로 로그인하고, 목록을 받아 와서 쓰기가 가능한 상태가 될 때까지 기다린다. */
export async function openApp(page: Page, hash = '#/today', username?: string) {
  await login(page, username);
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
