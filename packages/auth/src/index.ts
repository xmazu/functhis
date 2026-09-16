import { cimd } from '@better-auth/cimd';
import { mcp } from '@better-auth/mcp';
import { oauthDeviceAuthorization } from '@better-auth/oauth-provider';
import type { Database } from '@functhis/db';
import * as schema from '@functhis/db/schema/auth';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt, organization } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

import { fetchClientMetadataResource } from './cimd-fetch';
import { allocateUniqueHandle, normalizeHandleCandidate } from './handle';

export {
  DEPLOY_API_RESOURCE,
  parseBearerToken,
  validateDeployBearerToken,
  type DeployAuthResult,
  type DeployAuthOptions,
} from './deploy-token';
export { ensureCliOAuthClient } from './seed-cli-client';
export {
  allocateUniqueHandle,
  isValidHandle,
  normalizeHandleCandidate,
} from './handle';

export interface AuthConfig {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  TRUSTED_ORIGINS: string[];
}

const crossSubdomainCookies = (baseURL: string) => {
  try {
    const { hostname } = new URL(baseURL);
    if (hostname === 'functhis.now' || hostname.endsWith('.functhis.now')) {
      return {
        domain: 'functhis.now',
        enabled: true,
      };
    }
  } catch {
    return { enabled: false };
  }

  return { enabled: false };
};

export const createAuth = (env: AuthConfig, database: Database) =>
  betterAuth({
    advanced: {
      crossSubDomainCookies: crossSubdomainCookies(env.BETTER_AUTH_URL),
    },
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema,
    }),
    databaseHooks: {
      user: {
        create: {
          before: async (userRecord) => {
            const preferred =
              typeof userRecord.handle === 'string' &&
              userRecord.handle.length > 0
                ? userRecord.handle
                : userRecord.name;
            const handle = await allocateUniqueHandle(database, preferred);

            return {
              data: {
                ...userRecord,
                handle,
              },
            };
          },
        },
      },
    },
    disabledPaths: ['/token'],
    emailAndPassword: { enabled: false },
    plugins: [
      jwt({ disableSettingJwtHeader: true }),
      mcp({
        consentPage: '/consent',
        loginPage: '/login',
        resource: 'https://mcp.functhis.now',
        resources: ['https://mcp.functhis.now', 'https://functhis.now'],
      }),
      cimd({
        fetchClientMetadataResource,
        metadataProfile: 'mcp-2026-07-28',
      }),
      oauthDeviceAuthorization({ verificationUri: '/device' }),
      organization(),
      tanstackStartCookies(),
    ],
    rateLimit: {
      storage: 'database',
    },
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        mapProfileToUser(profile) {
          return {
            email: profile.email,
            emailVerified: true,
            handle: normalizeHandleCandidate(profile.login),
            image: profile.avatar_url,
            name: profile.name ?? profile.login,
          };
        },
      },
    },
    trustedOrigins: env.TRUSTED_ORIGINS,
    user: {
      additionalFields: {
        handle: {
          input: false,
          required: true,
          type: 'string',
        },
      },
    },
  });

export type Auth = ReturnType<typeof createAuth>;
