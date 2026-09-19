import { setTimeout as sleepMs } from 'node:timers/promises';

import {
  CLI_CLIENT_ID,
  DEPLOY_API_RESOURCE,
  loadConfig,
  resolveConsoleUrl,
  resolveWebUrl,
  saveConfig,
} from './config';
import type { CliConfig } from './config';

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

const tryOpenVerificationUrl = (url: string): void => {
  try {
    if (typeof Bun !== 'undefined' && typeof Bun.open === 'function') {
      Bun.open(url);
    }
  } catch {
    // ignore
  }
};

export const runLogin = async (options?: {
  consoleUrl?: string;
  webUrl?: string;
}): Promise<void> => {
  const existing = await loadConfig();
  const consoleUrl = resolveConsoleUrl(existing, options?.consoleUrl);
  const webUrl = resolveWebUrl(existing, options?.webUrl);

  const deviceResponse = await fetch(`${consoleUrl}/api/auth/device/code`, {
    body: new URLSearchParams({
      client_id: CLI_CLIENT_ID,
      resource: DEPLOY_API_RESOURCE,
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
    `${consoleUrl}/device?user_code=${encodeURIComponent(device.user_code)}`;

  console.log(`Open ${verifyUrl} and approve code ${device.user_code}`);
  tryOpenVerificationUrl(verifyUrl);

  const intervalMs = (device.interval ?? 5) * 1000;
  const deadline = Date.now() + device.expires_in * 1000;

  const pollForToken = async (): Promise<TokenResponse> => {
    if (Date.now() >= deadline) {
      throw new Error('Device login timed out');
    }

    await sleepMs(intervalMs);
    const tokenResponse = await fetch(`${consoleUrl}/oauth2/token`, {
      body: new URLSearchParams({
        client_id: CLI_CLIENT_ID,
        device_code: device.device_code,
        grant_type: DEVICE_CODE_GRANT,
        resource: DEPLOY_API_RESOURCE,
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
    consoleUrl,
    refreshToken: token.refresh_token,
    webUrl,
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
