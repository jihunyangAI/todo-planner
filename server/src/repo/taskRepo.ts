import { MongoServerError } from 'mongodb';
import type { Task, TaskCreate, TaskPatch } from '@todo/shared';
import type { Database, TaskDocument } from '../db.js';

export function toTask(doc: TaskDocument): Task {
  return {
    id: doc._id,
    title: doc.title,
    memo: doc.memo,
    plannedDate: doc.plannedDate,
    dueDate: doc.dueDate,
    priority: doc.priority,
    category: doc.category,
    completed: doc.completed,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

type CreateResult =
  | { status: 'created'; task: Task }
  | { status: 'existing'; task: Task }
  | { status: 'conflict' };

const DUPLICATE_KEY = 11000;

/** 모든 함수가 userId(로그인 사용자)를 첫 인자로 받는다. 소유자 조건이 빠진 쿼리를 만들 수 없게 하려는 구조다. */
export function taskRepo({ tasks }: Database) {
  return {
    async list(userId: string): Promise<Task[]> {
      const docs = await tasks.find({ userId }).toArray();
      return docs.map(toTask);
    },

    /** 같은 소유자의 같은 id가 이미 있으면 새로 만들지 않고 기존 작업을 돌려준다(멱등). */
    async create(userId: string, input: TaskCreate, now = new Date()): Promise<CreateResult> {
      const { id, ...fields } = input;
      const doc: TaskDocument = {
        _id: id,
        userId,
        ...fields,
        completedAt: fields.completed ? now : null,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await tasks.insertOne(doc);
        return { status: 'created', task: toTask(doc) };
      } catch (error) {
        if (!(error instanceof MongoServerError) || error.code !== DUPLICATE_KEY) throw error;
        const existing = await tasks.findOne({ _id: id, userId });
        return existing ? { status: 'existing', task: toTask(existing) } : { status: 'conflict' };
      }
    },

    /**
     * 바꿀 필드를 "이 값으로 설정"한다. completedAt은 완료 상태가 실제로 바뀔 때만 바꿔서,
     * 같은 요청을 다시 보내도 결과가 같다.
     */
    async update(userId: string, id: string, patch: TaskPatch, now = new Date()): Promise<Task | null> {
      const set: Record<string, unknown> = { updatedAt: { $literal: now } };
      for (const [key, value] of Object.entries(patch)) {
        // 파이프라인 업데이트에서 '$'로 시작하는 문자열이 필드 경로로 해석되지 않도록 $literal로 감싼다
        set[key] = { $literal: value };
      }
      if (patch.completed !== undefined) {
        set.completedAt = patch.completed
          ? { $cond: [{ $eq: ['$completed', true] }, '$completedAt', { $literal: now }] }
          : null;
      }
      const updated = await tasks.findOneAndUpdate({ _id: id, userId }, [{ $set: set }], {
        returnDocument: 'after',
      });
      return updated ? toTask(updated) : null;
    },

    async remove(userId: string, id: string): Promise<boolean> {
      const result = await tasks.deleteOne({ _id: id, userId });
      return result.deletedCount === 1;
    },

    /** 로그인 전 익명 클라이언트 ID로 만든, 아직 주인이 없는 작업을 이 사용자에게 귀속한다. */
    async claim(userId: string, legacyClientId: string): Promise<number> {
      const result = await tasks.updateMany(
        { legacyClientId, userId: null },
        { $set: { userId }, $unset: { legacyClientId: '' } },
      );
      return result.modifiedCount;
    },
  };
}
