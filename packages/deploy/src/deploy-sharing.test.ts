import { describe, expect, test } from 'bun:test';

import {
  hasDeploySharingInput,
  resolveDeploySharing,
  resolveDeploySharingForDeployStart,
} from './deploy-sharing';

describe('hasDeploySharingInput', () => {
  test('false when both fields omitted', () => {
    expect(hasDeploySharingInput({})).toBe(false);
  });

  test('true when visibility or organizationSlug is set', () => {
    expect(hasDeploySharingInput({ visibility: 'library' })).toBe(true);
    expect(hasDeploySharingInput({ organizationSlug: 'acme' })).toBe(true);
  });
});

describe('resolveDeploySharingForDeployStart', () => {
  test('preserves existing sharing when redeploy omits flags', async () => {
    const result = await resolveDeploySharingForDeployStart(
      {} as never,
      'user-1',
      {},
      {
        organizationId: 'org-1',
        visibility: 'organization',
      }
    );
    expect(result).toEqual({
      ok: true,
      value: { organizationId: 'org-1', visibility: 'organization' },
    });
  });

  test('defaults new packages to private without org', async () => {
    const result = await resolveDeploySharingForDeployStart(
      {} as never,
      'user-1',
      {},
      null
    );
    expect(result).toEqual({
      ok: true,
      value: { organizationId: null, visibility: 'private' },
    });
  });

  test('merges visibility when patching an existing package', async () => {
    const result = await resolveDeploySharingForDeployStart(
      {} as never,
      'user-1',
      { visibility: 'library' },
      {
        organizationId: 'org-1',
        visibility: 'organization',
      }
    );
    expect(result).toEqual({
      ok: true,
      value: { organizationId: null, visibility: 'library' },
    });
  });
});

describe('resolveDeploySharing', () => {
  test('requires organizationSlug when visibility is organization', async () => {
    const result = await resolveDeploySharing({} as never, 'user-1', {
      visibility: 'organization',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('organizationSlug');
    }
  });
});
