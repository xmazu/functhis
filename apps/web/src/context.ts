import type { Context as ApiContext } from '@functhis/api/context';

export const createContext = (_options?: { req?: Request }): ApiContext => ({});

export type Context = ReturnType<typeof createContext>;
