import { IconArrowUpRight, IconCheck, IconMail } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

const LOGIN_CALLBACK = '/d';

interface PricingPlan {
  name: string;
  description: string;
  price: string;
  priceSuffix?: string;
  badge?: string;
  cta: string;
  enterprise?: boolean;
  features: string[];
}

const COMMON_FEATURES = ['Private functions', 'Secrets management'];

const PLANS: PricingPlan[] = [
  {
    cta: 'Start free trial',
    description: 'Try the complete hosted workflow before you commit.',
    features: [
      'No credit card required',
      '5,000 executions',
      ...COMMON_FEATURES,
    ],
    name: 'Free trial',
    price: '$0',
    priceSuffix: 'for 14 days',
  },
  {
    badge: 'Most popular',
    cta: 'Start with Developer',
    description: 'For building and shipping personal tools.',
    features: ['100,000 executions', '7-day log retention', ...COMMON_FEATURES],
    name: 'Developer',
    price: '$19',
    priceSuffix: 'per month',
  },
  {
    cta: 'Choose Team',
    description: 'For teams sharing reliable functions and workflows.',
    features: [
      '1 million executions',
      '30-day log retention',
      'Team members',
      'Permissions',
      ...COMMON_FEATURES,
    ],
    name: 'Team',
    price: '$79',
    priceSuffix: 'per month',
  },
  {
    cta: 'Talk to us',
    description: 'For larger teams with custom requirements.',
    enterprise: true,
    features: [
      'Custom execution limits',
      'Custom retention',
      'Team members and permissions',
      ...COMMON_FEATURES,
    ],
    name: 'Enterprise',
    price: 'Custom',
  },
];

const PlanCta = ({ plan }: { plan: PricingPlan }) => {
  if (plan.enterprise) {
    return (
      <a
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-zinc-700 px-4 text-sm font-medium text-zinc-50 transition-colors duration-[120ms] hover:border-zinc-500 hover:bg-zinc-900"
        href="mailto:hello@functhis.now"
      >
        <IconMail aria-hidden="true" size={16} stroke={1.75} />
        {plan.cta}
      </a>
    );
  }

  return (
    <Link
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-zinc-50 px-4 text-sm font-medium text-zinc-950 transition-colors duration-[120ms] hover:bg-zinc-200"
      search={{ callbackURL: LOGIN_CALLBACK }}
      to="/login"
    >
      {plan.cta}
      <IconArrowUpRight aria-hidden="true" size={16} stroke={1.75} />
    </Link>
  );
};

const PricingCard = ({ plan }: { plan: PricingPlan }) => (
  <article
    className={`relative flex flex-col rounded-xl border p-6 ${
      plan.badge
        ? 'border-zinc-50/40 bg-zinc-900'
        : 'border-zinc-800 bg-zinc-950'
    }`}
  >
    {plan.badge ? (
      <span className="absolute top-4 right-4 rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-400">
        {plan.badge}
      </span>
    ) : null}
    <div className="min-h-[132px]">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
        {plan.name}
      </h2>
      <p className="mt-3 max-w-[250px] text-sm leading-6 text-zinc-400">
        {plan.description}
      </p>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-zinc-50">
          {plan.price}
        </span>
        {plan.priceSuffix ? (
          <span className="text-sm text-zinc-500">{plan.priceSuffix}</span>
        ) : null}
      </div>
    </div>
    <div className="mt-6">
      <PlanCta plan={plan} />
    </div>
    <ul className="mt-7 flex flex-col gap-3 border-t border-zinc-800 pt-6">
      {plan.features.map((feature) => (
        <li
          className="flex items-start gap-2.5 text-sm leading-5 text-zinc-300"
          key={feature}
        >
          <IconCheck
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-zinc-500"
            size={16}
            stroke={1.75}
          />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  </article>
);

export const PricingPage = () => (
  <main className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col px-6 pt-16 pb-[102px] md:pt-24">
    <section
      aria-labelledby="pricing-heading"
      className="mx-auto w-full max-w-[780px]"
    >
      <p className="text-xs font-semibold tracking-[0.1em] text-zinc-500 uppercase">
        Pricing
      </p>
      <h1
        className="mt-5 max-w-[650px] text-4xl leading-[1.1] font-semibold tracking-[-0.04em] text-balance text-zinc-50 sm:text-5xl"
        id="pricing-heading"
      >
        Publish useful functions without guessing what they will cost.
      </h1>
      <p className="mt-6 max-w-[650px] text-lg leading-7 tracking-[-0.02em] text-pretty text-zinc-400">
        Start free, then scale from a solo developer workflow to a team that
        shares secure, agent-ready tools.
      </p>
      <p className="mt-6 text-sm text-zinc-500">
        Every plan includes private functions and secrets.
      </p>
    </section>

    <section
      aria-label="Pricing plans"
      className="mt-14 grid gap-4 md:grid-cols-2"
    >
      {PLANS.map((plan) => (
        <PricingCard key={plan.name} plan={plan} />
      ))}
    </section>

    <section className="mx-auto mt-12 grid w-full max-w-[780px] gap-8 border-t border-zinc-800 pt-8 text-sm leading-6 text-zinc-400 sm:grid-cols-2">
      <div>
        <h2 className="font-medium text-zinc-50">What counts as usage?</h2>
        <p className="mt-2">
          Only function executions count toward your plan’s usage limit. MCP
          tool searches do not count, so agents can discover your functions
          without spending executions.
        </p>
      </div>
      <div>
        <h2 className="font-medium text-zinc-50">
          What happens after the trial?
        </h2>
        <p className="mt-2">
          Your functions stay saved and ready to pick up again. Execution is
          paused until you choose a paid plan.
        </p>
      </div>
    </section>
  </main>
);
