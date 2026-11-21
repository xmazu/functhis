import type { IdempotencyStorePort } from '../ports';
import { resolveIdempotency } from './idempotency';
import type { IdempotencyDecision, IdempotencyRecord } from './idempotency';

export const loadIdempotencyRecord = (
  store: IdempotencyStorePort,
  organizationId: string,
  key: string
): Promise<IdempotencyRecord | null> => store.load(organizationId, key);

export const claimIdempotencyKey = (input: {
  key: string;
  organizationId: string;
  requestHash: string;
  store: IdempotencyStorePort;
}): Promise<void> =>
  input.store.claim({
    key: input.key,
    organizationId: input.organizationId,
    requestHash: input.requestHash,
  });

export const completeIdempotencyKey = (input: {
  bodyText: string;
  key: string;
  organizationId: string;
  status: number;
  store: IdempotencyStorePort;
}): Promise<void> =>
  input.store.complete({
    bodyText: input.bodyText,
    key: input.key,
    organizationId: input.organizationId,
    status: input.status,
  });

export const decideIdempotency = (
  record: IdempotencyRecord | null,
  requestHash: string,
  nowMs = Date.now()
): IdempotencyDecision => resolveIdempotency(record, requestHash, nowMs);
