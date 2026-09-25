import { describe, expect, test } from 'bun:test';

import { isDashboardBootstrapPath } from './dashboard-bootstrap-path';

describe('isDashboardBootstrapPath', () => {
  test('includes workspace onboarding', () => {
    expect(isDashboardBootstrapPath('/d/setup/workspace')).toBe(true);
  });

  test('includes invitation accept', () => {
    expect(isDashboardBootstrapPath('/d/accept-invitation/abc')).toBe(true);
  });

  test('excludes main console routes', () => {
    expect(isDashboardBootstrapPath('/d/pkgs')).toBe(false);
    expect(isDashboardBootstrapPath('/d/orgs')).toBe(false);
  });
});
