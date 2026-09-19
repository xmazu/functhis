import type { PackageVisibility } from '@functhis/deploy';

const VISIBILITY_VALUES = new Set<PackageVisibility>([
  'private',
  'organization',
  'library',
]);

export const parseDeployVisibility = (
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
