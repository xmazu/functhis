import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { stripeClient } from '@better-auth/stripe/client';
import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [
    oauthProviderClient(),
    organizationClient(),
    stripeClient({ subscription: true }),
  ],
});
