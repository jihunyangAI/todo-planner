import { ObjectId } from 'mongodb';
import type { Database, UserDocument } from '../db.js';
import type { GithubUser } from '../github.js';

export interface User {
  id: string;
  username: string;
  avatarUrl: string;
}

const toUser = (doc: UserDocument): User => ({
  id: doc._id.toHexString(),
  username: doc.username,
  avatarUrl: doc.avatarUrl,
});

export function userRepo({ users }: Database) {
  return {
    /** GitHub 사용자 id로 찾아 username·avatarUrl을 최신 값으로 저장한다(없으면 만든다). */
    async upsertFromGithub(github: GithubUser, now = new Date()): Promise<User> {
      const doc = await users.findOneAndUpdate(
        { githubId: github.id },
        {
          $set: { username: github.login, avatarUrl: github.avatar_url, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true, returnDocument: 'after' },
      );
      if (!doc) throw new Error('사용자 저장에 실패했습니다');
      return toUser(doc);
    },

    async findById(id: string): Promise<User | null> {
      if (!ObjectId.isValid(id)) return null;
      const doc = await users.findOne({ _id: new ObjectId(id) });
      return doc ? toUser(doc) : null;
    },
  };
}
