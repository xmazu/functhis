import { describe, expect, test } from 'bun:test';

import { FUNCTHIS_PLANS, normalizePlanId, planLimits } from './plan-catalog';

describe('plan catalog', () => {
  test('normalizes the legacy pro subscription to developer', () => {
    expect(normalizePlanId('pro')).toBe('developer');
    expect(planLimits('pro')).toEqual(FUNCTHIS_PLANS.developer.limits);
  });

  test('falls back to trial for unknown plans', () => {
    expect(normalizePlanId('unknown')).toBe('trial');
    expect(planLimits('unknown')).toEqual(FUNCTHIS_PLANS.trial.limits);
  });

  test('keeps pricing retention aligned with plan limits', () => {
    expect(FUNCTHIS_PLANS.developer.limits.logRetentionDays).toBe(7);
    expect(FUNCTHIS_PLANS.team.limits.logRetentionDays).toBe(30);
    expect(FUNCTHIS_PLANS.trial.limits.logRetentionDays).toBe(0);
  });

  test('keeps package, execution, and Stripe price limits explicit', () => {
    expect(FUNCTHIS_PLANS.developer.limits.maxPackages).toBe(50);
    expect(FUNCTHIS_PLANS.developer.limits.maxExecutionsPerMonth).toBe(100_000);
    expect(FUNCTHIS_PLANS.developer.priceEnvKey).toBe(
      'STRIPE_PRICE_DEVELOPER_MONTHLY'
    );
    expect(FUNCTHIS_PLANS.team.limits.maxPackages).toBeNull();
    expect(FUNCTHIS_PLANS.team.limits.maxExecutionsPerMonth).toBe(1_000_000);
    expect(FUNCTHIS_PLANS.team.priceEnvKey).toBe('STRIPE_PRICE_TEAM_MONTHLY');
  });

  test('keeps enterprise uncapped and without a Stripe price', () => {
    expect(FUNCTHIS_PLANS.enterprise.limits.maxPackages).toBeNull();
    expect(FUNCTHIS_PLANS.enterprise.limits.maxExecutionsPerMonth).toBe(
      Number.MAX_SAFE_INTEGER
    );
    expect(FUNCTHIS_PLANS.enterprise.priceEnvKey).toBeNull();
  });
});
