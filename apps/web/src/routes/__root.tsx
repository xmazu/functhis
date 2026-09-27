import type { QueryClient } from '@tanstack/react-query';
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { evlogErrorHandler } from 'evlog/nitro/v3';

import { DashboardDevtools } from '#/components/dashboard-devtools';
import { Toaster } from '#/components/ui/sonner';
import type { orpc } from '#/utils/orpc';

import appCss from '#/index.css?url';

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

const RootDocument = () => (
  <html className="dark" lang="en">
    <head>
      <HeadContent />
    </head>
    <body>
      <Outlet />
      <Toaster richColors />
      <DashboardDevtools />
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRouteWithContext<RouterAppContext>()({
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
      {
        rel: 'icon',
        href: '/extension_icon.ico',
        type: 'image/x-icon',
      },
    ],
  }),

  component: RootDocument,
});
