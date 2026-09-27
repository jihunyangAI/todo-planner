import { expect, test } from '@playwright/test';
import { goTo, login, openApp, quickAdd, task, uniqueUser, waitForSaved } from './helpers';

test('로그인하지 않으면 로그인 화면이 보이고 할 일 API는 401이다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'GitHub로 로그인' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '주요 화면' })).toHaveCount(0);
  expect((await page.request.get('/api/tasks')).status()).toBe(401);
  expect((await page.request.get('/api/me')).status()).toBe(401);
});

test('GitHub로 로그인하면 앱으로 돌아오고 설정에 username과 아바타가 보인다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'GitHub로 로그인' }).click();
  const username = uniqueUser('octo');
  await page.getByLabel('GitHub 사용자 이름').fill(username);
  await page.getByRole('button', { name: 'Authorize' }).click();

  await expect(page.getByRole('heading', { name: '오늘', level: 1 })).toBeVisible();
  await goTo(page, '설정');
  await expect(page.getByText(username, { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: `${username} 프로필 사진` })).toHaveAttribute('src', /^data:image\/svg\+xml/);
  const me = await (await page.request.get('/api/me')).json();
  expect(me).toMatchObject({ username });
});

test('사용자 A가 만든 작업은 사용자 B에게 보이지 않는다', async ({ browser }) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await openApp(pageA, '#/all', uniqueUser('alice'));
  await quickAdd(pageA, '할 일 추가 (날짜 없이)', 'A만 보는 작업');
  await waitForSaved(pageA);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await openApp(pageB, '#/all', uniqueUser('bob'));
  await expect(pageB.getByText('아직 할 일이 없습니다.')).toBeVisible();
  await expect(task(pageB, 'A만 보는 작업')).toHaveCount(0);
  const tasksB = await (await pageB.request.get('/api/tasks')).json();
  expect(tasksB).toEqual([]);

  // A가 다시 로그인해도 자기 작업은 그대로다
  await pageA.reload();
  await expect(task(pageA, 'A만 보는 작업')).toBeVisible();
  await contextA.close();
  await contextB.close();
});

test('로그아웃하면 세션이 사라져 새로고침해도 로그인 화면이고 API는 401이다', async ({ page }) => {
  await openApp(page, '#/all');
  await quickAdd(page, '할 일 추가 (날짜 없이)', '로그아웃 전 작업');
  await waitForSaved(page);

  await goTo(page, '설정');
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByRole('link', { name: 'GitHub로 로그인' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'GitHub로 로그인' })).toBeVisible();
  expect((await page.request.get('/api/tasks')).status()).toBe(401);
  expect((await page.request.get('/api/me')).status()).toBe(401);
});

test('같은 GitHub 계정으로 다른 브라우저에서 로그인하면 같은 목록이 보인다', async ({ browser }) => {
  const username = uniqueUser('same');
  const first = await browser.newContext();
  const page1 = await first.newPage();
  await openApp(page1, '#/all', username);
  await quickAdd(page1, '할 일 추가 (날짜 없이)', '어디서나 보는 작업');
  await waitForSaved(page1);

  const second = await browser.newContext();
  const page2 = await second.newPage();
  await login(page2, username);
  await goTo(page2, '전체');
  await expect(task(page2, '어디서나 보는 작업')).toBeVisible();
  await first.close();
  await second.close();
});
