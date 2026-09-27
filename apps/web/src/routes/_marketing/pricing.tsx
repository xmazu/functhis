import { createFileRoute } from '@tanstack/react-router';

import { PricingPage } from '#/components/marketing/pricing-page';

export const Route = createFileRoute('/_marketing/pricing')({
  component: PricingPage,
});
