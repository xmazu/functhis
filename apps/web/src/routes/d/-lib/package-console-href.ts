/** Canonical signed-in package console URL (/@org-slug/package-slug). */
export const packageConsoleHref = (
  handle: string,
  packageSlug: string,
  section?: 'secrets' | 'sharing'
): string => {
  const base = `/@${handle}/${packageSlug}`;
  if (section === 'secrets') {
    return `${base}/secrets`;
  }
  if (section === 'sharing') {
    return `${base}/sharing`;
  }
  return base;
};
