import { CLI_CLIENT_ID, PUBLISH_API_RESOURCE } from '@functhis/publish/oauth';

import { loadConfig, resolveUrl, saveConfig } from './config';
import type { CliConfig } from './config';

const TOKEN_REFRESH_SKEW_MS = 60_000;

interface RefreshTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
}

const accessTokenStillValid = (config: CliConfig): boolean => {
  if (!config.expiresAt) {
    return true;
  }
  return Date.parse(config.expiresAt) > Date.now() + TOKEN_REFRESH_SKEW_MS;
};

const refreshAccessToken = async (config: CliConfig): Promise<CliConfig> => {
  if (!config.refreshToken) {
    throw new Error('Access token expired. Run: functhis login');
  }

  const url = resolveUrl(config);
  const tokenResponse = await fetch(`${url}/oauth2/token`, {
    body: new URLSearchParams({
      client_id: CLI_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      resource: PUBLISH_API_RESOURCE,
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  if (!tokenResponse.ok) {
    throw new Error(
      `Failed to refresh access token (${tokenResponse.status}). Run: functhis login`
    );
  }

  const token = (await tokenResponse.json()) as RefreshTokenResponse;
  const next: CliConfig = {
    ...config,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? config.refreshToken,
    ...(token.expires_in
      ? {
          expiresAt: new Date(
            Date.now() + token.expires_in * 1000
          ).toISOString(),
        }
      : { expiresAt: undefined }),
  };
  await saveConfig(next);
  return next;
};

/** Returns config with a valid access token, refreshing when possible. */
export const ensureValidAccessToken = (
  config: CliConfig
): Promise<CliConfig> => {
  if (accessTokenStillValid(config)) {
    return Promise.resolve(config);
  }
  return refreshAccessToken(config);
};

export const loadAuthenticatedConfig = async (): Promise<CliConfig> => {
  const config = await loadConfig();
  if (!config) {
    throw new Error('Not logged in. Run: functhis login');
  }
  return ensureValidAccessToken(config);
};
