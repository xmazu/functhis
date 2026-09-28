import type { Database } from '@functhis/db';
import { executeIdempotency } from '@functhis/db/schema/catalog';
import { and, eq } from 'drizzle-orm';

import { resolveIdempotency } from './idempotency';
import type { IdempotencyDecision, IdempotencyRecord } from './idempotency';

export const loadIdempotencyRecord = async (
  database: Database,
  organizationId: string,
  key: string
): Promise<IdempotencyRecord | null> => {
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
};

export const claimIdempotencyKey = async (input: {
  database: Database;
  key: string;
  organizationId: string;
  requestHash: string;
}): Promise<void> => {
  const now = new Date();
  await input.database
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
};

export const completeIdempotencyKey = async (input: {
  bodyText: string;
  database: Database;
  key: string;
  organizationId: string;
  status: number;
}): Promise<void> => {
  await input.database
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
};

export const decideIdempotency = (
  record: IdempotencyRecord | null,
  requestHash: string,
  nowMs = Date.now()
): IdempotencyDecision => resolveIdempotency(record, requestHash, nowMs);
