/** Canonical signed-in package console URL (/@org-slug/package-slug). */
export const packageConsoleHref = (
  handle: string,
  packageSlug: string,
  section?: 'secrets'
): string => {
  const base = `/@${handle}/${packageSlug}`;
  if (section === 'secrets') {
    return `${base}/secrets`;
  }
  return base;
};
