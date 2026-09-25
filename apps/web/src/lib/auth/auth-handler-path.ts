const AUTH_BASE_PATH = '/api/auth';

const WELL_KNOWN_PATHS = [
  '/.well-known/oauth-authorization-server',
  '/.well-known/openid-configuration',
] as const;

const issuerWellKnownPath = (pathname: string): string | null => {
  for (const wellKnown of WELL_KNOWN_PATHS) {
    if (
      pathname === wellKnown ||
      pathname === `${wellKnown}${AUTH_BASE_PATH}`
    ) {
      return `${AUTH_BASE_PATH}${wellKnown}`;
    }
  }
  return null;
};

/** Path the Better Auth handler expects for this public URL. */
export const resolveAuthHandlerPath = (pathname: string): string => {
  const wellKnown = issuerWellKnownPath(pathname);
  if (wellKnown) {
    return wellKnown;
  }
  if (pathname.startsWith(AUTH_BASE_PATH)) {
    return pathname;
  }
  return `${AUTH_BASE_PATH}${pathname}`;
};

/**
 * RFC 8414 inserts the issuer path after the well-known segment
 * (`/.well-known/oauth-authorization-server/api/auth`). The registered
 * routes are the unsuffixed well-known paths.
 */
export const rewriteOAuthDiscoveryRequest = (request: Request): Request => {
  const url = new URL(request.url);
  for (const wellKnown of WELL_KNOWN_PATHS) {
    if (url.pathname === `${wellKnown}${AUTH_BASE_PATH}`) {
      url.pathname = wellKnown;
      return new Request(url, request);
    }
  }
  return request;
};
