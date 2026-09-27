export type FuncthisPlanId = 'trial' | 'developer' | 'team' | 'enterprise';

export interface FuncthisPlanLimits {
  logRetentionDays: number;
  maxExecutionsPerMonth: number;
  maxPackages: number | null;
}

export interface FuncthisPlan {
  description: string;
  limits: FuncthisPlanLimits;
  name: string;
  priceMonthlyCents: number | null;
  priceEnvKey: string | null;
}

export const FUNCTHIS_PLANS: Record<FuncthisPlanId, FuncthisPlan> = {
  developer: {
    description: 'For building and shipping personal tools.',
    limits: {
      logRetentionDays: 7,
      maxExecutionsPerMonth: 100_000,
      maxPackages: 50,
    },
    name: 'Developer',
    priceEnvKey: 'STRIPE_PRICE_DEVELOPER_MONTHLY',
    priceMonthlyCents: 1900,
  },
  enterprise: {
    description: 'For larger teams with custom requirements.',
    limits: {
      logRetentionDays: 30,
      maxExecutionsPerMonth: Number.MAX_SAFE_INTEGER,
      maxPackages: null,
    },
    name: 'Enterprise',
    priceEnvKey: null,
    priceMonthlyCents: null,
  },
  team: {
    description: 'For teams sharing reliable functions and workflows.',
    limits: {
      logRetentionDays: 30,
      maxExecutionsPerMonth: 1_000_000,
      maxPackages: null,
    },
    name: 'Team',
    priceEnvKey: 'STRIPE_PRICE_TEAM_MONTHLY',
    priceMonthlyCents: 7900,
  },
  trial: {
    description: 'Try the complete hosted workflow before you commit.',
    limits: {
      logRetentionDays: 0,
      maxExecutionsPerMonth: 5000,
      maxPackages: 3,
    },
    name: 'Free trial',
    priceEnvKey: null,
    priceMonthlyCents: null,
  },
};

export const normalizePlanId = (plan: string): FuncthisPlanId => {
  if (plan === 'pro') {
    return 'developer';
  }
  if (plan in FUNCTHIS_PLANS) {
    return plan as FuncthisPlanId;
  }
  return 'trial';
};

export const planLimits = (plan: string): FuncthisPlanLimits =>
  FUNCTHIS_PLANS[normalizePlanId(plan)].limits;
