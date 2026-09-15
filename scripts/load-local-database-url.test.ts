import { describe, expect, test } from 'bun:test';

import { parseEnvFile } from './load-local-database-url';

describe('parseEnvFile', () => {
  test('parses simple assignments', () => {
    expect(
      parseEnvFile('DATABASE_URL=postgres://localhost/db\nFOO=bar')
    ).toEqual({
      DATABASE_URL: 'postgres://localhost/db',
      FOO: 'bar',
    });
  });

  test('skips comments and blank lines', () => {
    expect(
      parseEnvFile(`
# comment
DATABASE_URL=postgres://localhost/db

# another
`)
    ).toEqual({
      DATABASE_URL: 'postgres://localhost/db',
    });
  });

  test('strips export prefix and quotes', () => {
    expect(
      parseEnvFile(`export DATABASE_URL="postgres://user:pass@host/db"`)
    ).toEqual({
      DATABASE_URL: 'postgres://user:pass@host/db',
    });
  });
});
