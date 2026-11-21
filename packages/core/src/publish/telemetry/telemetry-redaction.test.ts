import { describe, expect, test } from 'bun:test';

import {
  AXIOM_MAX_INPUT_BYTES,
  AXIOM_MAX_LOG_BYTES,
  AXIOM_MAX_LOGS,
  AXIOM_MAX_OUTPUT_BYTES,
  buildExecutionEvent,
  capTelemetryValue,
} from './axiom';
import { redactTelemetry, redactTelemetryJson } from './telemetry-redaction';

describe('telemetry redaction', () => {
  test('redacts sensitive keys, bearer values, and configured secrets', () => {
    expect(
      redactTelemetry(
        {
          authorization: 'Bearer abc',
          message: 'value=do-not-send',
          nested: { password: 'secret' },
        },
        ['do-not-send']
      )
    ).toEqual({
      authorization: '[REDACTED]',
      message: '[REDACTED]',
      nested: { password: '[REDACTED]' },
    });
  });

  test('does not throw for circular payloads', () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expect(redactTelemetryJson(value)).toContain('[TRUNCATED]');
  });

  test('redacts nested secrets before building execution telemetry', () => {
    expect(
      buildExecutionEvent({
        executionId: 'exec-1',
        input: { credentials: { token: 'secret-value' } },
        organizationId: 'org-1',
        output: { authorization: 'Bearer abc' },
        secretValues: ['secret-value'],
        status: 'ok',
        versionId: 'ver-1',
      })
    ).toMatchObject({
      input: { credentials: { token: '[REDACTED]' } },
      output: { authorization: '[REDACTED]' },
    });
  });

  test('caps oversized input and output without retaining payload data', () => {
    const oversized = 'x'.repeat(AXIOM_MAX_INPUT_BYTES + 1);
    expect(capTelemetryValue(oversized, AXIOM_MAX_INPUT_BYTES)).toEqual({
      truncated: true,
    });
    expect(capTelemetryValue({ ok: true }, AXIOM_MAX_OUTPUT_BYTES)).toEqual({
      ok: true,
    });
  });

  test('defines bounded Axiom log limits', () => {
    expect(AXIOM_MAX_LOGS).toBe(200);
    expect(AXIOM_MAX_LOG_BYTES).toBe(2048);
  });
});
