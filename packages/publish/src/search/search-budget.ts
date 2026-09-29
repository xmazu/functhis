/* eslint-disable promise/avoid-new -- Promise.race timeout fallback */
export const withTimeout = async <T>(
  work: Promise<T>,
  budgetMs: number,
  fallback: T
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), budgetMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};
