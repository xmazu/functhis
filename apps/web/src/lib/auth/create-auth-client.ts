import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { stripeClient } from '@better-auth/stripe/client';
import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export interface CreateFuncthisAuthClientOptions {
  /** Empty string = same origin (TanStack Start / Workers). */
  baseURL?: string;
}

export const createFuncthisAuthClient = (
  options: CreateFuncthisAuthClientOptions = {}
) =>
  createAuthClient({
    baseURL: options.baseURL ?? '',
    plugins: [
      oauthProviderClient(),
      organizationClient(),
      stripeClient({ subscription: true }),
    ],
  });

export type FuncthisAuthClient = ReturnType<typeof createFuncthisAuthClient>;
