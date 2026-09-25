import { resolveCallerUserId } from '@functhis/auth';
import type { Database } from '@functhis/db';
import {
  buildPackageAccessContext,
  safeCallbackURLFromRequest,
} from '@functhis/publish';
import type { CatalogPackageRow } from '@functhis/publish';

import { env } from '#/env.server';
import { createAuth, getDb } from '#/services';

import { evaluateCatalogAccess } from './access-policy';
import type { CatalogAccessResult } from './access-policy';

export {
  evaluateCatalogAccess,
  type CatalogAccessResult,
} from './access-policy';

export const buildCatalogLoginUrl = (requestUrl: string): string => {
  const callbackPath = safeCallbackURLFromRequest(requestUrl);
  const loginUrl = new URL('/login', new URL(requestUrl).origin);
  loginUrl.searchParams.set('callbackURL', callbackPath);
  return loginUrl.href;
};

export interface ResolveCatalogAccessOptions {
  database?: Database;
  /** Skips session/bearer resolution when provided (including `null`). */
  resolvedUserId?: string | null;
}

const publishAuthOptions = (database: Database) => ({
  consoleUrl: env.BETTER_AUTH_URL,
  resolveSessionUserId: async (request: Request) => {
    const auth = await createAuth(database);
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    const userId = session?.user?.id;
    return typeof userId === 'string' && userId.length > 0 ? userId : null;
  },
});

export const resolveCatalogAccess = async (
  request: Request,
  catalog: CatalogPackageRow,
  options?: ResolveCatalogAccessOptions
): Promise<CatalogAccessResult> => {
  const database = options?.database ?? (await getDb());

  let userId: string | null;
  if (options?.resolvedUserId === undefined) {
    const auth = await resolveCallerUserId(
      database,
      request,
      publishAuthOptions(database)
    );
    userId = auth.ok ? auth.userId : null;
  } else {
    userId = options.resolvedUserId;
  }

  const context = await buildPackageAccessContext(database, userId);
  return evaluateCatalogAccess(catalog, context);
};
