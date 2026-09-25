import {
  isOrgBillingAdmin,
  isStripePluginConfigured,
} from '@functhis/auth/stripe-plugin';
import { createDb } from '@functhis/db';
import { member } from '@functhis/db/schema/auth';
import {
  countOrgPackages,
  limitsForPlan,
  readOrgExecutionCount,
  resolveOrgPlan,
} from '@functhis/publish';
import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { env } from '#/env.server';
import { authMiddleware } from '#/middleware/auth';

export const getOrgBillingSummary = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ organizationId: z.string() }))
  .handler(async ({ context, data }) => {
    const userId = context.session?.user?.id;
    if (!userId) {
      return null;
    }

    const database = await createDb(env);

    const [membership] = await database
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, data.organizationId)
        )
      )
      .limit(1);

    if (!membership) {
      return null;
    }

    const plan = await resolveOrgPlan(database, data.organizationId);
    const limits = limitsForPlan(plan);
    const [packageCount, executionCount, canManageBilling] = await Promise.all([
      countOrgPackages(database, data.organizationId),
      readOrgExecutionCount(database, data.organizationId),
      isOrgBillingAdmin(database, userId, data.organizationId),
    ]);

    const billingEnabled = isStripePluginConfigured({
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
