import type { PackageVisibility } from '@functhis/publish/package-visibility';

const VISIBILITY_VALUES = new Set<PackageVisibility>([
  'private',
  'organization',
  'library',
]);

export const parsePublishVisibility = (
  raw: string | undefined
): PackageVisibility | undefined => {
  if (raw === undefined) {
    return undefined;
  }
  if (!VISIBILITY_VALUES.has(raw as PackageVisibility)) {
    throw new Error(
      'Invalid --visibility. Use private, organization, or library.'
    );
  }
  return raw as PackageVisibility;
};
