import { Outlet, createFileRoute } from '@tanstack/react-router';

import Header from '#/components/header';
import { SiteFooter } from '#/components/marketing/site-footer';

const MarketingLayout = () => (
  <div className="flex min-h-svh flex-col" data-surface="marketing">
    <Header />
    <Outlet />
    <SiteFooter />
  </div>
);

export const Route = createFileRoute('/_marketing')({
  component: MarketingLayout,
});
