import { z } from 'zod';

/** 'YYYY-MM-DD' 현지 날짜. 시간대 정보는 없다. */
export type ISODate = string;

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export const CATEGORIES = ['work', 'personal', 'study'] as const;
export type Priority = (typeof PRIORITIES)[number];
export type Category = (typeof CATEGORIES)[number];

export const TITLE_MAX = 100;
export const MEMO_MAX = 2000;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** 소문자 UUID v4만 참이다. 클라이언트 ID와 작업 ID 모두 이 형식을 쓴다. */
export function isUuidV4(value: string): boolean {
  return UUID_V4.test(value);
}

/** 형식이 'YYYY-MM-DD'이면서 달력에 실제로 있는 날짜인지 확인한다. */
export function isValidISODate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export const UuidSchema = z.string().refine(isUuidV4, 'UUID v4 형식이 아닙니다');
export const ISODateSchema = z.string().refine(isValidISODate, '올바른 날짜가 아닙니다');

export const TitleSchema = z
  .string()
  .trim()
  .min(1, '제목을 입력하세요')
  .max(TITLE_MAX, `제목은 ${TITLE_MAX}자 이하로 입력하세요`);
export const MemoSchema = z.string().max(MEMO_MAX, `메모는 ${MEMO_MAX}자 이하로 입력하세요`);

const editableFields = {
  title: TitleSchema,
  memo: MemoSchema,
  plannedDate: ISODateSchema.nullable(),
  dueDate: ISODateSchema.nullable(),
  priority: z.enum(PRIORITIES),
  category: z.enum(CATEGORIES).nullable(),
  completed: z.boolean(),
};

export const TaskCreateSchema = z
  .object({
    id: UuidSchema,
    title: editableFields.title,
    memo: editableFields.memo.default(''),
    plannedDate: editableFields.plannedDate.default(null),
    dueDate: editableFields.dueDate.default(null),
    priority: editableFields.priority.default('medium'),
    category: editableFields.category.default(null),
    completed: editableFields.completed.default(false),
  })
  .strict();

/** 바꿀 필드의 새 값. id·ownerId·completedAt·createdAt·updatedAt은 서버만 관리하므로 받지 않는다. */
export const TaskPatchSchema = z
  .object(editableFields)
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, '바꿀 필드가 없습니다');

export type TaskCreate = z.infer<typeof TaskCreateSchema>;
export type TaskCreateInput = z.input<typeof TaskCreateSchema>;
export type TaskPatch = z.infer<typeof TaskPatchSchema>;

export interface Task {
  id: string;
  title: string;
  memo: string;
  plannedDate: ISODate | null;
  dueDate: ISODate | null;
  priority: Priority;
  category: Category | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FieldErrors = Partial<Record<string, string>>;

/** zod 오류를 필드별 첫 메시지로 바꾼다. 폼과 API 응답이 같은 형태를 쓴다. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    errors[key] ??= issue.message;
  }
  return errors;
}
