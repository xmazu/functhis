import { describe, expect, test } from 'bun:test';

import {
  extractOpenApiOperations,
  openApiServerUrl,
} from './openapi-operations';

describe('openapi operations', () => {
  test('extracts methods and pins the first server url', () => {
    const spec = {
      paths: {
        '/users/{email}': {
          get: {
            description: 'Find a user by email',
            operationId: 'usersSearch',
            summary: 'Find user',
          },
        },
      },
      servers: [{ url: 'https://api.crm.example/' }],
    };
    expect(openApiServerUrl(spec)).toBe('https://api.crm.example');
    expect(extractOpenApiOperations(spec)).toEqual([
      {
        description: 'Find a user by email',
        method: 'get',
        operationId: 'userssearch',
        path: '/users/{email}',
        requestSchema: { additionalProperties: true, type: 'object' },
        summary: 'Find user',
      },
    ]);
  });
});
