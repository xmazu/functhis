import { lazy, Suspense } from 'react';

const TanStackRouterDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const mod = await import('@tanstack/react-router-devtools');
      return { default: mod.TanStackRouterDevtools };
    })
  : null;

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const mod = await import('@tanstack/react-query-devtools');
      return { default: mod.ReactQueryDevtools };
    })
  : null;

export const DashboardDevtools = () => {
  if (!(TanStackRouterDevtools && ReactQueryDevtools)) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
    </Suspense>
  );
};
