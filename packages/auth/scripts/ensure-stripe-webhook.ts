/**
 * Ensure Stripe webhook for Better Auth billing (platforms-billing webhook-cli).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_... bun packages/auth/scripts/ensure-stripe-webhook.ts --url https://functhis.now
 *   ... --rotate   # delete + recreate (prints new signing secret)
 */

import StripeSdk from 'stripe';

const STRIPE_WEBHOOK_ENABLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.paused',
  'customer.subscription.resumed',
] as const;

const parseArgs = (): { rotate: boolean; url: string } => {
  const args = process.argv.slice(2);
  let url = '';
  let rotate = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--rotate') {
      rotate = true;
    } else if (arg === '--url' && args[index + 1]) {
      url = args[index + 1] ?? '';
      index += 1;
    }
  }
  if (!url) {
    console.error(
      'Usage: ensure-stripe-webhook.ts --url <app-origin> [--rotate]'
    );
    process.exit(1);
  }
  return { rotate, url };
};

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!stripeSecretKey) {
  console.error('Missing STRIPE_SECRET_KEY');
  process.exit(1);
}

const { rotate, url } = parseArgs();
const stripe = new StripeSdk(stripeSecretKey, {
  apiVersion: '2026-08-26.dahlia',
});

const webhookPath = '/api/auth/stripe/webhook';
const endpointUrl = `${url.replace(/\/$/u, '')}${webhookPath}`;

const existing = await stripe.webhookEndpoints.list({ limit: 100 });
const match = existing.data.find((endpoint) => endpoint.url === endpointUrl);

if (match && !rotate) {
  console.log(`Webhook already exists: ${match.id} → ${endpointUrl}`);
  console.log(
    'Pass --rotate to recreate and print a new STRIPE_WEBHOOK_SECRET.'
  );
  process.exit(0);
}

if (match && rotate) {
  await stripe.webhookEndpoints.del(match.id);
  console.log(`Deleted ${match.id}`);
}

const created = await stripe.webhookEndpoints.create({
  enabled_events: [...STRIPE_WEBHOOK_ENABLED_EVENTS],
  url: endpointUrl,
});

console.log(`Created webhook ${created.id} → ${endpointUrl}`);
if (process.env.CI) {
  console.warn(
    'Retrieve STRIPE_WEBHOOK_SECRET from the Stripe Dashboard (not printed in CI).'
  );
} else if (created.secret) {
  console.warn('\nAdd to apps/web/.env and Secrets Store (do not commit):\n');
  console.warn(`STRIPE_WEBHOOK_SECRET=${created.secret}`);
}
