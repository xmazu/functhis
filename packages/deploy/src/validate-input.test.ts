import { describe, expect, test } from 'bun:test';

import { validateContractInput } from './validate-input';

describe('validateContractInput', () => {
  test('skips validation when schema is missing', () => {
    expect(validateContractInput(undefined, { any: true })).toEqual({
      ok: true,
    });
  });

  test('accepts any JSON for an empty schema', () => {
    expect(validateContractInput({}, 42)).toEqual({ ok: true });
    expect(validateContractInput({}, 'x')).toEqual({ ok: true });
  });

  test('rejects missing required fields', () => {
    const result = validateContractInput(
      {
        additionalProperties: false,
        properties: { id: { type: 'string' } },
        required: ['id'],
        type: 'object',
      },
      {}
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  test('rejects extra properties on a closed object', () => {
    const result = validateContractInput(
      {
        additionalProperties: false,
        properties: { id: { type: 'string' } },
        required: ['id'],
        type: 'object',
      },
      { extra: true, id: 'x' }
    );
    expect(result.ok).toBe(false);
  });

  test('accepts valid input', () => {
    expect(
      validateContractInput(
        {
          additionalProperties: false,
          properties: { id: { type: 'string' } },
          required: ['id'],
          type: 'object',
        },
        { id: 'x' }
      )
    ).toEqual({ ok: true });
  });

  test('accepts string or number against anyOf', () => {
    const schema = {
      anyOf: [{ type: 'number' }, { type: 'string' }],
    };
    expect(validateContractInput(schema, 'x')).toEqual({ ok: true });
    expect(validateContractInput(schema, 42)).toEqual({ ok: true });
    expect(validateContractInput(schema, { extra: true }).ok).toBe(false);
  });

  test('accepts enum values', () => {
    const schema = { enum: ['a', 'b'], type: 'string' };
    expect(validateContractInput(schema, 'a')).toEqual({ ok: true });
    expect(validateContractInput(schema, 'c').ok).toBe(false);
  });
});
