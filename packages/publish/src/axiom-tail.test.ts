import { describe, expect, test } from 'bun:test';

import {
  AXIOM_REDACTION_MODULE_ID,
  AXIOM_TAIL_MODULE_ID,
  createAxiomRedactionModuleSource,
  createAxiomTailModuleSource,
} from './axiom-tail';
import {
  TELEMETRY_SENSITIVE_KEY_PATTERN,
  TELEMETRY_SENSITIVE_VALUE_PATTERN,
} from './telemetry-redaction';

describe('Axiom tail modules', () => {
  test('creates a redaction module with sensitive-value rules', () => {
    const source = createAxiomRedactionModuleSource();

    expect(source).toContain(TELEMETRY_SENSITIVE_KEY_PATTERN);
    expect(source).toContain(TELEMETRY_SENSITIVE_VALUE_PATTERN);
    expect(source).toContain('[REDACTED]');
  });

  test('creates a tail module with execution correlation and caps', () => {
    const source = createAxiomTailModuleSource();

    expect(AXIOM_REDACTION_MODULE_ID).toContain('redaction');
    expect(AXIOM_TAIL_MODULE_ID).toContain('tail');
    expect(source).toContain('x-functhis-execution-id');
    expect(source).toContain('MAX_LOGS');
    expect(source).toContain('api.axiom.co');
    expect(source).toContain('response.ok');
  });
});
