import type {
  IdempotencyRecord,
  IdempotencyStorePort,
} from '@functhis/core/publish';

import { and, eq } from '../drizzle';
import type { Database } from '../index';
import { executeIdempotency } from '../schema/catalog';

export const createIdempotencyStorePort = (
  database: Database
): IdempotencyStorePort => ({
  async claim(input) {
    const now = new Date();
    await database
      .insert(executeIdempotency)
      .values({
        key: input.key,
        organizationId: input.organizationId,
        requestHash: input.requestHash,
        status: 'in_progress',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          bodyText: null,
          requestHash: input.requestHash,
          responseStatus: null,
          status: 'in_progress',
          updatedAt: now,
        },
        target: [executeIdempotency.organizationId, executeIdempotency.key],
      });
  },

  async complete(input) {
    await database
      .update(executeIdempotency)
      .set({
        bodyText: input.bodyText,
        responseStatus: input.status,
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(executeIdempotency.organizationId, input.organizationId),
          eq(executeIdempotency.key, input.key)
        )
      );
  },

  async load(organizationId, key) {
    const [row] = await database
      .select()
      .from(executeIdempotency)
      .where(
        and(
          eq(executeIdempotency.organizationId, organizationId),
          eq(executeIdempotency.key, key)
        )
      )
      .limit(1);
    if (!row) {
      return null;
    }
    return {
      requestHash: row.requestHash,
      status: row.status as IdempotencyRecord['status'],
      storedResponse:
        row.bodyText === null || row.responseStatus === null
          ? null
          : { bodyText: row.bodyText, status: row.responseStatus },
      updatedAtMs: row.updatedAt.getTime(),
    };
  },
});
