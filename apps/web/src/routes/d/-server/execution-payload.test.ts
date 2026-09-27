import { describe, expect, test } from 'bun:test';

import {
  executionPayloadFromAxiomRecords,
  unavailableExecutionPayload,
} from './execution-payload';

const reference = {
  createdAt: new Date('2026-09-27T12:00:00.000Z'),
  logRetentionDays: 7,
  startedAt: new Date('2026-09-27T12:00:00.000Z'),
};

describe('execution payload states', () => {
  test('marks a recent empty Axiom result as missing telemetry', () => {
    expect(executionPayloadFromAxiomRecords([], reference)).toEqual({
      payload: null,
      payloadState: 'missing',
    });
  });

  test('marks an old empty Axiom result as expired', () => {
    expect(
      executionPayloadFromAxiomRecords([], {
        ...reference,
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
        startedAt: new Date('2020-01-01T00:00:00.000Z'),
      })
    ).toEqual({
      payload: null,
      payloadState: 'expired',
    });
  });

  test('returns the execution event and logs in record order', () => {
    expect(
      executionPayloadFromAxiomRecords(
        [
          {
            executionId: 'exec-1',
            input: { name: 'Ada' },
            output: { greeting: 'Hello' },
          },
          {
            executionId: 'exec-1',
            level: 'info',
            message: 'started',
            timestamp: '2026-09-27T18:00:00.000Z',
            type: 'log',
          },
        ],
        reference
      )
    ).toEqual({
      payload: {
        input: { name: 'Ada' },
        logs: [
          {
            level: 'info',
            message: 'started',
            timestamp: '2026-09-27T18:00:00.000Z',
          },
        ],
        output: { greeting: 'Hello' },
      },
      payloadState: 'available',
    });
  });

  test('represents an unavailable telemetry backend explicitly', () => {
    expect(unavailableExecutionPayload()).toEqual({
      payload: null,
      payloadState: 'unavailable',
    });
  });
});
