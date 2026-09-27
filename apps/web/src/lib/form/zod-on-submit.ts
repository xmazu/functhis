import type { z } from 'zod';

export const zodOnSubmit =
  <T extends z.ZodType>(schema: T) =>
  ({ value }: { value: z.infer<T> }): string | undefined => {
    const result = schema.safeParse(value);
    if (result.success) {
      return undefined;
    }
    return result.error.issues[0]?.message ?? 'Invalid form';
  };
