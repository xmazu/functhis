import type { Context as ApiContext } from '@functhis/api/context';

import { getDb, createAuth } from './services';

export async function createContext({
  req,
}: {
  req: Request;
}): Promise<ApiContext> {
  const db = await getDb();
  const session = await (
    await createAuth(db)
  ).api.getSession({
    headers: req.headers,
  });
  return {
    auth: null,
    db,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
