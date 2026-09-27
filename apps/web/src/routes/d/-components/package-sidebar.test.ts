import { describe, expect, test } from 'bun:test';

import { showsSharingNav } from '#/routes/d/-components/package-sidebar';
import type { PackageDetailViewModel } from '#/routes/d/-server/package-detail-view-model';

const baseDetail = {
  canWriteSecrets: true,
  executions: [],
  functions: [],
  handle: 'acme',
  isOwner: true,
  missingSecretNames: [],
  organizationId: 'org_1',
  organizationSlug: 'acme',
  packageId: 'pkg_1',
  packageSlug: 'tools',
  publishedAt: new Date(),
  secrets: [],
  semver: '1.0.0',
} satisfies Omit<PackageDetailViewModel, 'visibility'>;

describe('showsSharingNav', () => {
  test('includes owner private and organization packages', () => {
    expect(showsSharingNav({ ...baseDetail, visibility: 'private' })).toBe(
      true
    );
    expect(showsSharingNav({ ...baseDetail, visibility: 'organization' })).toBe(
      true
    );
  });

  test('excludes non-owners and library visibility', () => {
    expect(
      showsSharingNav({ ...baseDetail, isOwner: false, visibility: 'private' })
    ).toBe(false);
    expect(showsSharingNav({ ...baseDetail, visibility: 'library' })).toBe(
      false
    );
  });
});
