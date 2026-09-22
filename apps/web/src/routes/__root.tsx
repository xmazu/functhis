import { Toaster } from '@functhis/ui/components/sonner';
import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { createMiddleware } from '@tanstack/react-start';
import { evlogErrorHandler } from 'evlog/nitro/v3';

import Header from '#/components/header';
import type { orpc } from '#/utils/orpc';

import appCss from '#/index.css?url';

export interface RouterAppContext {
  consoleUrl: string;
  orpc: typeof orpc;
  queryClient: QueryClient;
}

const RootDocument = () => (
  <html className="dark" lang="en">
    <head>
      <HeadContent />
    </head>
    <body>
      <div className="flex min-h-svh flex-col">
        <Header />
        <Outlet />
      </div>
      <Toaster richColors />
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRouteWithContext<RouterAppContext>()({
  beforeLoad: async () => {
    const { resolveConsoleUrl } =
      await import('#/functions/resolve-console-url');
    return { consoleUrl: await resolveConsoleUrl() };
  },
  server: {
    middleware: [createMiddleware().server(evlogErrorHandler)],
  },

  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Functhis',
      },
      {
        name: 'description',
        content:
          'Write a TypeScript function. Share a working tool. Deploy with Functhis and let people or agents run it.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});
