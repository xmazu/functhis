import { describe, expect, test } from 'bun:test';

import { packageConsoleHref } from './package-console-href';

describe('packageConsoleHref', () => {
  test('builds overview path', () => {
    expect(packageConsoleHref('weselnemomenty', 'hello-world')).toBe(
      '/@weselnemomenty/hello-world'
    );
  });

  test('builds secrets path', () => {
    expect(packageConsoleHref('weselnemomenty', 'hello-world', 'secrets')).toBe(
      '/@weselnemomenty/hello-world/secrets'
    );
  });
});
