/** Same-origin relative paths only; blocks open redirects via protocol-relative or absolute URLs. */
export const safeCallbackURL = (raw: unknown, fallback = '/'): string => {
  if (typeof raw !== 'string' || raw.length === 0) {
    return fallback;
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return fallback;
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(raw)) {
    return fallback;
  }
  return raw;
};

/** Build a safe console login callback from an incoming request URL. */
export const safeCallbackURLFromRequest = (
  requestUrl: string,
  fallback = '/'
): string => {
  try {
    const { pathname, search } = new URL(requestUrl);
    return safeCallbackURL(`${pathname}${search}`, fallback);
  } catch {
    return fallback;
  }
};
