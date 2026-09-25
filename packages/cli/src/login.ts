import { setTimeout as sleepMs } from 'node:timers/promises';

import {
  CLI_CLIENT_ID,
  PUBLISH_API_RESOURCE,
  loadConfig,
  resolveUrl,
  saveConfig,
} from './config';
import type { CliConfig } from './config';
import { openUrl } from './open-url';

const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

interface DeviceCodeResponse {
  device_code: string;
  expires_in: number;
  interval?: number;
  user_code: string;
  verification_uri?: string;
  verification_uri_complete?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
}

export const runLogin = async (options?: { url?: string }): Promise<void> => {
  const existing = await loadConfig();
  const url = resolveUrl(existing, options?.url);

  const deviceResponse = await fetch(`${url}/api/auth/device/code`, {
    body: new URLSearchParams({
      client_id: CLI_CLIENT_ID,
      resource: PUBLISH_API_RESOURCE,
    }),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });

  if (!deviceResponse.ok) {
    throw new Error(await deviceResponse.text());
  }

  const device = (await deviceResponse.json()) as DeviceCodeResponse;
  const verifyUrl =
    device.verification_uri_complete ??
    `${url}/device?user_code=${encodeURIComponent(device.user_code)}`;

  console.log(`Open ${verifyUrl} and approve code ${device.user_code}`);
  openUrl(verifyUrl);

  const intervalMs = (device.interval ?? 5) * 1000;
  const deadline = Date.now() + device.expires_in * 1000;

  const pollForToken = async (): Promise<TokenResponse> => {
    if (Date.now() >= deadline) {
      throw new Error('Device login timed out');
    }

    await sleepMs(intervalMs);
    const tokenResponse = await fetch(`${url}/oauth2/token`, {
      body: new URLSearchParams({
        client_id: CLI_CLIENT_ID,
        device_code: device.device_code,
        grant_type: DEVICE_CODE_GRANT,
        resource: PUBLISH_API_RESOURCE,
      }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });

    if (tokenResponse.status === 400) {
      const raw = await tokenResponse.text();
      let errorCode: string | undefined;
      try {
        errorCode = (JSON.parse(raw) as { error?: string }).error;
      } catch {
        throw new Error(raw);
      }
      if (errorCode === 'authorization_pending' || errorCode === 'slow_down') {
        if (errorCode === 'slow_down') {
          await sleepMs(intervalMs * 2);
        }
        return pollForToken();
      }
      throw new Error(errorCode ? `Device login failed: ${errorCode}` : raw);
    }

    if (!tokenResponse.ok) {
      throw new Error(await tokenResponse.text());
    }

    return (await tokenResponse.json()) as TokenResponse;
  };

  const token = await pollForToken();
  const config: CliConfig = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    url,
    ...(token.expires_in
      ? {
          expiresAt: new Date(
            Date.now() + token.expires_in * 1000
          ).toISOString(),
        }
      : {}),
  };
  await saveConfig(config);
  console.log('Logged in. Token saved to ~/.config/functhis/config.json');
};
