export const authIssuerFromConsoleUrl = (consoleUrl: string): string =>
  new URL('/api/auth', consoleUrl).href;

export const authJwksUrlFromConsoleUrl = (consoleUrl: string): string =>
  new URL('/api/auth/jwks', consoleUrl).href;
