// Web session app. Imports Better Auth's TanStack Start cookie plugin.
// Wrangler cannot bundle that plugin, so workers use a subpath export
// (`@functhis/auth/publish-token`, `@functhis/auth/seed-cli-client`).
import { cimd } from '@better-auth/cimd';
import { mcp } from '@better-auth/mcp';
import { oauthDeviceAuthorization } from '@better-auth/oauth-provider';
import type { Database } from '@functhis/db';
import * as schema from '@functhis/db/schema/auth';
import { PUBLISH_API_RESOURCE } from '@functhis/publish/oauth';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { jwt, organization } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';

import { fetchClientMetadataResource } from './cimd-fetch';
import {
  allocateUniqueHandle,
  normalizeHandleCandidate,
  userHandleExists,
} from './handle';
import { createStripePlugin } from './stripe-plugin';

export interface AuthConfig {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  MCP_RESOURCE: string;
  STRIPE_PRO_PRICE_ID?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  TRUSTED_ORIGINS: string[];
  /** Invalidate HOT membership cache when org membership changes. */
  syncMembershipHot?: (userId: string) => Promise<void>;
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

export const createAuth = (env: AuthConfig, database: Database) => {
  const assertOrgSlugAvailable = async (slug: unknown): Promise<void> => {
    if (typeof slug !== 'string') {
      return;
    }
    if (await userHandleExists(database, slug)) {
      throw new APIError('BAD_REQUEST', {
        message: `Slug ${slug} is already used by a user`,
      });
    }
  };

  const stripePlugin = createStripePlugin(env, database);

  return betterAuth({
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
        resource: env.MCP_RESOURCE,
        resources: [env.MCP_RESOURCE, PUBLISH_API_RESOURCE],
      }),
      cimd({
        fetchClientMetadataResource,
        metadataProfile: 'mcp-2026-07-28',
      }),
      oauthDeviceAuthorization({ verificationUri: '/device' }),
      organization({
        organizationHooks: {
          afterAddMember: async ({ member: memberRow }) => {
            await env.syncMembershipHot?.(memberRow.userId);
          },
          afterRemoveMember: async ({ member: memberRow }) => {
            await env.syncMembershipHot?.(memberRow.userId);
          },
          beforeCreateOrganization: async ({ organization: created }) => {
            await assertOrgSlugAvailable(created.slug);
          },
          beforeUpdateOrganization: async ({ organization: updated }) => {
            await assertOrgSlugAvailable(updated.slug);
          },
        },
        sendInvitationEmail: async () => {
          // Console shows copyable invite links; no outbound email in alpha.
        },
      }),
      ...(stripePlugin ? [stripePlugin] : []),
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
          // OAuth profile fields with input:false are stripped before validation;
          // the create hook assigns a unique handle before insert.
          input: false,
          required: false,
          type: 'string',
        },
      },
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;
