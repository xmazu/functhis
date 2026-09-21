const DEFAULT_INTEGRATION_DATABASE_URL =
  'postgres://functhis:functhis@127.0.0.1:5432/integration';

export const INTEGRATION_DATABASE_NAME = 'integration';

export const integrationDatabaseUrl = (): string =>
  process.env.INTEGRATION_DATABASE_URL ?? DEFAULT_INTEGRATION_DATABASE_URL;

export const assertLocalDatabaseUrl = (databaseUrl: string): void => {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error(`Invalid integration database URL: ${databaseUrl}`);
  }

  const allowedHosts = new Set(['127.0.0.1', 'localhost']);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error(
      `Refusing integration tests against non-local database host: ${url.hostname}`
    );
  }

  const databaseName = url.pathname.replace(/^\//u, '');
  if (databaseName !== INTEGRATION_DATABASE_NAME) {
    throw new Error(
      `Refusing integration tests against database "${databaseName}"; use "${INTEGRATION_DATABASE_NAME}"`
    );
  }
};
