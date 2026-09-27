/** Canonical OAuth resource identifier (origin-only URLs drop a trailing slash). */
export const normalizeOAuthResourceIdentifier = (
  identifier: string
): string => {
  const trimmed = identifier.trim();
  try {
    const url = new URL(trimmed);
    const isOriginOnly =
      (url.pathname === '/' || url.pathname === '') &&
      url.search === '' &&
      url.hash === '';
    if (isOriginOnly) {
      return `${url.protocol}//${url.host}`;
    }
    if (url.pathname.endsWith('/') && url.pathname.length > 1) {
      return trimmed.replace(/\/$/u, '');
    }
    return trimmed;
  } catch {
    return trimmed.replace(/\/$/u, '');
  }
};

/** Strings that must resolve to the same logical resource (Cursor adds a trailing slash on origins). */
export const oauthResourceIdentifierVariants = (
  identifier: string
): string[] => {
  const canonical = normalizeOAuthResourceIdentifier(identifier);
  const variants = new Set<string>([identifier.trim(), canonical]);
  try {
    const url = new URL(canonical);
    const isOriginOnly =
      (url.pathname === '/' || url.pathname === '') &&
      url.search === '' &&
      url.hash === '';
    if (isOriginOnly) {
      variants.add(`${url.protocol}//${url.host}/`);
    }
  } catch {
    // keep canonical + raw only
  }
  return [...variants];
};
