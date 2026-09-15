import type { Context as ApiContext } from '@functhis/api/context';

export async function createContext(_options?: {
  req?: Request;
}): Promise<ApiContext> {
  return {};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
