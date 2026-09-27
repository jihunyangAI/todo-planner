import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { AppConfig } from '../config.js';
import type { Database } from '../db.js';
import type { GithubClient } from '../github.js';
import { requireRequestedWith, requireUser } from '../middleware/auth.js';
import { userRepo } from '../repo/userRepo.js';
import { SESSION_COOKIE, cookieOptions } from '../session.js';
import { handle } from './handle.js';

const promisify = (fn: (cb: (err?: unknown) => void) => void) =>
  new Promise<void>((resolve, reject) => fn((err) => (err ? reject(err) : resolve())));

interface AuthDeps {
  config: AppConfig;
  database: Database;
  github: GithubClient;
}

/** /auth/github, /auth/github/callback, /auth/logout */
export function authRouter({ config, database, github }: AuthDeps) {
  const users = userRepo(database);
  const redirectUri = `${config.publicUrl}/auth/github/callback`;
  const router = Router();

  router.get(
    '/github',
    handle(async (req, res) => {
      const state = randomBytes(16).toString('hex');
      req.session.oauthState = state;
      await promisify((cb) => req.session.save(cb));
      res.redirect(github.authorizeUrl({ state, redirectUri }));
    }),
  );

  router.get(
    '/github/callback',
    handle(async (req, res) => {
      const { code, state, error } = req.query;
      const expected = req.session.oauthState;
      delete req.session.oauthState;
      if (typeof state !== 'string' || !expected || state !== expected) {
        res.status(400).type('text').send('로그인 요청이 올바르지 않습니다. 처음부터 다시 로그인해 주세요.');
        return;
      }
      // 사용자가 GitHub 화면에서 허락을 거부한 경우
      if (error || typeof code !== 'string' || !code) {
        res.redirect('/');
        return;
      }
      let user;
      try {
        const token = await github.exchangeCode(code, redirectUri);
        user = await users.upsertFromGithub(await github.getUser(token));
      } catch (err) {
        req.log.warn({ err }, 'GitHub 로그인 실패');
        res.status(502).type('text').send('GitHub 로그인에 실패했습니다. 잠시 뒤 다시 시도해 주세요.');
        return;
      }
      // 로그인 전 세션을 이어 쓰지 않도록 세션 ID를 새로 발급한다(세션 고정 공격 방지)
      await promisify((cb) => req.session.regenerate(cb));
      req.session.userId = user.id;
      await promisify((cb) => req.session.save(cb));
      res.redirect('/');
    }),
  );

  router.post(
    '/logout',
    requireRequestedWith,
    handle(async (req, res) => {
      await promisify((cb) => req.session.destroy(cb));
      res.clearCookie(SESSION_COOKIE, cookieOptions(config));
      res.status(204).end();
    }),
  );

  return router;
}

/** GET /api/me */
export function meRouter({ config, database }: { config: AppConfig; database: Database }) {
  const users = userRepo(database);
  const router = Router();
  router.get(
    '/',
    requireUser,
    handle(async (req, res) => {
      const user = await users.findById(res.locals.userId);
      if (!user) {
        await promisify((cb) => req.session.destroy(cb));
        res.clearCookie(SESSION_COOKIE, cookieOptions(config));
        res.status(401).json({ error: '로그인이 필요합니다' });
        return;
      }
      res.json(user);
    }),
  );
  return router;
}
