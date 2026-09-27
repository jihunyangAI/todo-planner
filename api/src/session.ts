import MongoStore from 'connect-mongo';
import session from 'express-session';
import type { AppConfig } from './config.js';
import type { Database } from './db.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    /** OAuth 요청 위조를 막기 위한 1회용 값 */
    oauthState?: string;
  }
}

export const SESSION_COOKIE = 'todo.sid';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export function cookieOptions(config: AppConfig) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: config.cookieSecure, path: '/' };
}

/** 세션은 MongoDB `sessions` 컬렉션에 저장한다. 로그아웃하면 저장소에서 지운다. */
export function sessionMiddleware(config: AppConfig, { client, db }: Database) {
  return session({
    name: SESSION_COOKIE,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { ...cookieOptions(config), maxAge: SESSION_TTL_SECONDS * 1000 },
    store: MongoStore.create({
      client,
      dbName: db.databaseName,
      collectionName: 'sessions',
      ttl: SESSION_TTL_SECONDS,
    }),
  });
}
