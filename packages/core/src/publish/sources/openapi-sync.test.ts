import { describe, expect, test } from 'bun:test';

import { importOpenApiSource } from './openapi-sync';

const input = (spec: unknown) => ({
  database: {} as never,
  hot: {} as never,
  organizationId: 'org',
  ownerUserId: 'user',
  slug: 'source',
  spec,
});

describe('OpenAPI sync validation', () => {
  test('rejects a non-object specification', async () => {
    await expect(importOpenApiSource(input(null))).rejects.toThrow(
      'OpenAPI spec must be an object'
    );
  });

  test('rejects a specification without a server URL', async () => {
    await expect(
      importOpenApiSource(input({ openapi: '3.0.0' }))
    ).rejects.toThrow('OpenAPI spec is missing servers[0].url');
  });

  test('rejects a specification without operations', async () => {
    await expect(
      importOpenApiSource(
        input({
          openapi: '3.0.0',
          paths: {},
          servers: [{ url: 'https://api.example.test' }],
        })
      )
    ).rejects.toThrow('OpenAPI spec has no operations');
  });
});
