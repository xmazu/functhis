import { describe, expect, test } from 'bun:test';

import { isPackageConsolePath } from './package-console-path';

describe('isPackageConsolePath', () => {
  test('matches package overview and nested pages', () => {
    expect(isPackageConsolePath('/@weselnemomenty/hello-world')).toBe(true);
    expect(isPackageConsolePath('/@weselnemomenty/hello-world/secrets')).toBe(
      true
    );
  });

  test('excludes workspace routes', () => {
    expect(isPackageConsolePath('/d/pkgs')).toBe(false);
    expect(isPackageConsolePath('/d/pkgs/acme/tools')).toBe(false);
  });
});
