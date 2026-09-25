import { TaskCreateSchema, toFieldErrors, type FieldErrors, type TaskCreateInput } from '@todo/shared';

export type TaskFormValues = Omit<Required<TaskCreateInput>, 'id' | 'completed'>;

export interface FormValidation {
  errors: FieldErrors;
  warnings: FieldErrors;
}

const FormSchema = TaskCreateSchema.omit({ id: true, completed: true });

/** 오류는 shared 스키마를 그대로 쓰고, 실행 예정일이 마감일보다 늦을 때만 경고를 더한다(저장은 허용). */
export function validateTaskForm(values: TaskFormValues): FormValidation {
  const parsed = FormSchema.safeParse(values);
  const errors = parsed.success ? {} : toFieldErrors(parsed.error);
  const warnings: FieldErrors = {};
  if (values.plannedDate && values.dueDate && values.plannedDate > values.dueDate) {
    warnings.plannedDate = '실행 예정일이 마감일보다 늦습니다. 저장은 할 수 있습니다.';
  }
  return { errors, warnings };
}
