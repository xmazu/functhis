import { stripe } from '@better-auth/stripe';
import type { Database } from '@functhis/db';
import { member } from '@functhis/db/schema/auth';
import { PRO_ORG_LIMITS } from '@functhis/publish/org-entitlements';
import { and, eq } from 'drizzle-orm';
import StripeSdk from 'stripe';

export interface StripePluginConfig {
  STRIPE_PRO_PRICE_ID?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

const billingRoles = new Set(['owner', 'admin']);

export const isBillingRole = (role: string): boolean => billingRoles.has(role);

const resolveRequiredStripeConfig = (
  config: StripePluginConfig
): {
  STRIPE_PRO_PRICE_ID: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
} | null => {
  const stripeSecretKey = config.STRIPE_SECRET_KEY?.trim();
  const stripeWebhookSecret = config.STRIPE_WEBHOOK_SECRET?.trim();
  const stripeProPriceId = config.STRIPE_PRO_PRICE_ID?.trim();
  if (!stripeSecretKey || !stripeWebhookSecret || !stripeProPriceId) {
    return null;
  }
  return {
    STRIPE_PRO_PRICE_ID: stripeProPriceId,
    STRIPE_SECRET_KEY: stripeSecretKey,
    STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
  };
};

export const isStripePluginConfigured = (config: StripePluginConfig): boolean =>
  resolveRequiredStripeConfig(config) !== null;

export const createStripePlugin = (
  config: StripePluginConfig,
  database: Database
) => {
  const stripeConfig = resolveRequiredStripeConfig(config);
  if (!stripeConfig) {
    return null;
  }

  const stripeClient = new StripeSdk(stripeConfig.STRIPE_SECRET_KEY, {
    apiVersion: '2026-08-26.dahlia',
    httpClient: StripeSdk.createFetchHttpClient(),
  });

  return stripe({
    organization: {
      enabled: true,
    },
    stripeClient,
    stripeWebhookSecret: stripeConfig.STRIPE_WEBHOOK_SECRET,
    subscription: {
      authorizeReference: async ({ referenceId, user }) => {
        const [membership] = await database
          .select({ role: member.role })
          .from(member)
          .where(
            and(
              eq(member.userId, user.id),
              eq(member.organizationId, referenceId)
            )
          )
          .limit(1);

        return membership ? isBillingRole(membership.role) : false;
      },
      enabled: true,
      plans: [
        {
          limits: { ...PRO_ORG_LIMITS },
          name: 'pro',
          priceId: stripeConfig.STRIPE_PRO_PRICE_ID,
        },
      ],
    },
  });
};

export const isOrgBillingAdmin = async (
  database: Database,
  userId: string,
  organizationId: string
): Promise<boolean> => {
  const [membership] = await database
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId))
    )
    .limit(1);

  return membership ? isBillingRole(membership.role) : false;
};
