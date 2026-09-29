import { describe, expect, test } from 'bun:test';

import type { HotKvBinding } from '@functhis/publish/http-context';

import { normalizeSearchDomain, searchFunctions } from './search';

const memoryHot = (): HotKvBinding => ({
  delete: () => Promise.resolve(),
  get: () => Promise.resolve(null),
  put: () => Promise.resolve(),
});

describe('normalizeSearchDomain', () => {
  test('defaults to mine', () => {
    expect(normalizeSearchDomain()).toBe('mine');
    expect(normalizeSearchDomain('org')).toBe('org');
  });
});

describe('searchFunctions', () => {
  test('uses the offline embedding path and forwards the result', async () => {
    const hot = memoryHot();
    const result = await searchFunctions(
      { HOT: hot } as Env,
      { callerUserId: 'user', query: 'mail' },
      undefined,
      {
        isEmbeddingOffline: () => true,
        resolveOpenRouterApiKey: async () => {
          await Promise.resolve();
        },
        searchFunctionsWithContext: async (context, input, options) => {
          expect(context.embedQueries).toBeUndefined();
          expect(await context.hot.get('missing')).toBeNull();
          expect(input.query).toBe('mail');
          expect(options?.rerankScorer).toBeDefined();
          return {
            ambiguous: false,
            reason: 'no_match',
            results: [],
            timing: {
              jevMs: 0,
              lexicalMs: 0,
              loadMs: 0,
              totalMs: 0,
              vectorMs: 0,
            },
          };
        },
      }
    );
    expect(result.reason).toBe('no_match');
  });

  test('embeds when the environment is online', async () => {
    let embedded = false;
    const result = await searchFunctions(
      { CAPABILITY_VECTOR_INDEX: {}, HOT: memoryHot() } as Env,
      { callerUserId: 'user', query: 'mail' },
      undefined,
      {
        embedTexts: async (_env, texts) => {
          await Promise.resolve();
          embedded = texts[0] === 'probe';
          return [[1]];
        },
        isEmbeddingOffline: () => false,
        resolveOpenRouterApiKey: async () => {
          await Promise.resolve();
          return 'key';
        },
        searchFunctionsWithContext: async (context) => {
          await context.embedQueries?.(['probe']);
          return {
            ambiguous: false,
            reason: 'no_match',
            results: [],
            timing: {
              jevMs: 0,
              lexicalMs: 0,
              loadMs: 0,
              totalMs: 0,
              vectorMs: 0,
            },
          };
        },
        vectorIndexFactory: () => ({}) as never,
      }
    );
    expect(embedded).toBe(true);
    expect(result.reason).toBe('no_match');
  });
});
