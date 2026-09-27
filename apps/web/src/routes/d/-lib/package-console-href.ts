/** Canonical signed-in package console URL (/@org-slug/package-slug). */
export const packageConsoleHref = (
  handle: string,
  packageSlug: string,
  section?: 'executions' | 'secrets'
): string => {
  const base = `/@${handle}/${packageSlug}`;
  if (section === 'executions') {
    return `${base}/executions`;
  }
  if (section === 'secrets') {
    return `${base}/secrets`;
  }
  return base;
};
