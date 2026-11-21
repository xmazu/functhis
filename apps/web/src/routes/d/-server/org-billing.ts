import {
  isOrgBillingAdmin,
  isStripePluginConfigured,
} from '@functhis/auth/stripe-plugin';
import {
  countOrgPackages,
  isMemberOfOrganization,
  limitsForPlan,
  readOrgExecutionCount,
  resolveOrgPlan,
} from '@functhis/platform';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { env } from '#/env.server';
import { authMiddleware } from '#/middleware/auth';
import { getDb, getPlatform } from '#/services';

export const getOrgBillingSummary = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ organizationId: z.string() }))
  .handler(async ({ context, data }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      return null;
    }

    const platform = await getPlatform();
    const database = await getDb();

    const isMember = await isMemberOfOrganization(
      platform.memberships,
      userId,
      data.organizationId
    );

    if (!isMember) {
      return null;
    }

    const plan = await resolveOrgPlan(platform.quota, data.organizationId);
    const limits = limitsForPlan(plan);
    const [packageCount, executionCount, canManageBilling] = await Promise.all([
      countOrgPackages(platform.quota, data.organizationId),
      readOrgExecutionCount(platform.quota, data.organizationId),
      isOrgBillingAdmin(database, userId, data.organizationId),
    ]);

    const billingEnabled = isStripePluginConfigured({
      STRIPE_PRICE_DEVELOPER_MONTHLY: env.STRIPE_PRICE_DEVELOPER_MONTHLY,
      STRIPE_PRICE_TEAM_MONTHLY: env.STRIPE_PRICE_TEAM_MONTHLY,
      STRIPE_PRO_PRICE_ID: env.STRIPE_PRO_PRICE_ID,
      STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    });

    return {
      billingEnabled,
      canManageBilling,
      executionCount,
      limits,
      packageCount,
      plan,
    };
  });
