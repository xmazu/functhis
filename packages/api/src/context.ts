import type { createAuth } from '@functhis/auth';
import type { Database } from '@functhis/db';

export interface Context {
  auth: null;
  session: Awaited<
    ReturnType<ReturnType<typeof createAuth>['api']['getSession']>
  >;
  db: Database;
}
