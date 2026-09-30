/**
 * Idempotently sync Functhis paid plans to Stripe products + monthly prices.
 * Adapted from @xmazu/platforms-billing syncStripe (metadata.plan matching).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... bun packages/auth/scripts/sync-stripe-catalog.ts
 */

import { FUNCTHIS_PLANS } from '@functhis/publish';
import type { FuncthisPlanId } from '@functhis/publish';
import type StripeSdk from 'stripe';

const paidPlanIds = [
  'developer',
  'team',
] as const satisfies readonly FuncthisPlanId[];

const createStripeClient = (): StripeSdk => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return new StripeSdk(stripeSecretKey, {
    apiVersion: '2026-08-26.dahlia',
  });
};

const findProductByPlanKey = async (
  stripe: StripeSdk,
  planKey: string
): Promise<StripeSdk.Product | null> => {
  const listed = await stripe.products.list({ active: true, limit: 100 });
  return (
    listed.data.find((product) => product.metadata?.plan === planKey) ?? null
  );
};

const findMonthlyPrice = async (
  stripe: StripeSdk,
  productId: string,
  planKey: string
): Promise<StripeSdk.Price | null> => {
  const listed = await stripe.prices.list({
    active: true,
    limit: 100,
    product: productId,
  });
  return (
    listed.data.find(
      (price) =>
        price.metadata?.plan === planKey &&
        price.metadata?.interval === 'monthly' &&
        price.recurring?.interval === 'month'
    ) ?? null
  );
};

const ensureProduct = async (
  stripe: StripeSdk,
  planKey: string,
  name: string,
  description: string
): Promise<StripeSdk.Product> => {
  const existing = await findProductByPlanKey(stripe, planKey);
  const metadata = { plan: planKey };

  if (existing) {
    if (existing.name !== name || existing.description !== description) {
      return stripe.products.update(existing.id, {
        description,
        metadata,
        name,
      });
    }
    return existing;
  }

  return stripe.products.create({
    description,
    metadata,
    name,
  });
};

const ensureMonthlyPrice = async (
  stripe: StripeSdk,
  productId: string,
  planKey: string,
  unitAmount: number
): Promise<StripeSdk.Price> => {
  const existing = await findMonthlyPrice(stripe, productId, planKey);

  if (existing) {
    if (existing.unit_amount === unitAmount && existing.currency === 'usd') {
      return existing;
    }
    await stripe.prices.update(existing.id, { active: false });
  }

  return stripe.prices.create({
    currency: 'usd',
    metadata: { interval: 'monthly', plan: planKey },
    product: productId,
    recurring: { interval: 'month' },
    unit_amount: unitAmount,
  });
};

export interface SyncStripeCatalogResult {
  developerPriceId: string;
  teamPriceId: string;
}

export const syncStripeCatalog = async (): Promise<SyncStripeCatalogResult> => {
  const stripe = createStripeClient();
  const priceIds: Partial<Record<'developer' | 'team', string>> = {};

  /* eslint-disable no-await-in-loop -- Stripe catalog sync is intentionally sequential */
  for (const planId of paidPlanIds) {
    const plan = FUNCTHIS_PLANS[planId];
    const amount = plan.priceMonthlyCents;
    if (amount === null) {
      continue;
    }

    const product = await ensureProduct(
      stripe,
      planId,
      plan.name,
      plan.description
    );
    const price = await ensureMonthlyPrice(stripe, product.id, planId, amount);
    priceIds[planId] = price.id;
    console.log(
      `${planId}: product=${product.id} price=${price.id} ($${(amount / 100).toFixed(2)}/mo)`
    );
  }

  const developerPriceId = priceIds.developer;
  const teamPriceId = priceIds.team;
  if (!developerPriceId || !teamPriceId) {
    throw new Error(
      'Failed to resolve Stripe price IDs for developer and team plans'
    );
  }

  return { developerPriceId, teamPriceId };
};

export const formatStripeCatalogEnv = (
  result: SyncStripeCatalogResult
): string =>
  [
    `STRIPE_PRICE_DEVELOPER_MONTHLY=${result.developerPriceId}`,
    `STRIPE_PRICE_TEAM_MONTHLY=${result.teamPriceId}`,
    `STRIPE_PRO_PRICE_ID=${result.developerPriceId}`,
  ].join('\n');

if (import.meta.main) {
  try {
    const result = await syncStripeCatalog();
    console.log('\nPaste into apps/web/.env (and production Secrets Store):\n');
    console.log(formatStripeCatalogEnv(result));
    console.log(
      '\nTrial is implicit — no Stripe price. Enterprise is contract-priced.'
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
