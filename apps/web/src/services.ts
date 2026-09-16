import { createDb } from '@functhis/db';
import type { Database } from '@functhis/db';

import { env } from './env.server';

export const getDb = (): Promise<Database> => createDb(env);
