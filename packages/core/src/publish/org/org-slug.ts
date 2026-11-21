/** Normalize a display name into an organization slug (deploy/console rules). */
export const normalizeOrganizationSlug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '')
    .slice(0, 64) || 'org';
