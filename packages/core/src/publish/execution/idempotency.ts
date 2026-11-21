import { sha256Hex } from '../bundle';
import { EXECUTE_CPU_MS } from '../constants';

export const IDEMPOTENCY_STALE_GRACE_MS = 5000;

export const idempotencyStaleBeforeMs = (nowMs = Date.now()): number =>
  nowMs - (EXECUTE_CPU_MS + IDEMPOTENCY_STALE_GRACE_MS);

export const createIdempotencyRequestHash = (input: {
  arguments: unknown;
  id: string;
}): Promise<string> =>
  sha256Hex(JSON.stringify({ arguments: input.arguments ?? {}, id: input.id }));

export type IdempotencyRecordStatus = 'in_progress' | 'completed';

export interface IdempotencyRecord {
  requestHash: string;
  status: IdempotencyRecordStatus;
  storedResponse: {
    bodyText: string;
    status: number;
  } | null;
  updatedAtMs: number;
}

export type IdempotencyDecision =
  | { kind: 'claim' }
  | { kind: 'in_progress' }
  | { kind: 'mismatch' }
  | {
      kind: 'replay';
      response: { bodyText: string; replayed: true; status: number };
    }
  | { kind: 'unavailable' };

export const resolveIdempotency = (
  record: IdempotencyRecord | null,
  requestHash: string,
  nowMs = Date.now()
): IdempotencyDecision => {
  if (!record) {
    return { kind: 'claim' };
  }
  if (record.requestHash !== requestHash) {
    return { kind: 'mismatch' };
  }
  if (record.status === 'in_progress') {
    if (record.updatedAtMs <= idempotencyStaleBeforeMs(nowMs)) {
      return { kind: 'claim' };
    }
    return { kind: 'in_progress' };
  }
  if (!record.storedResponse) {
    return { kind: 'unavailable' };
  }
  return {
    kind: 'replay',
    response: {
      bodyText: record.storedResponse.bodyText,
      replayed: true,
      status: record.storedResponse.status,
    },
  };
};
