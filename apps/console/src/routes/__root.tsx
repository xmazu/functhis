import { Toaster } from '@functhis/ui/components/sonner';
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { createMiddleware } from '@tanstack/react-start';
import { evlogErrorHandler } from 'evlog/nitro/v3';

import appCss from '../index.css?url';

const RootDocument = () => (
  <html lang="en" className="dark">
    <head>
      <HeadContent />
    </head>
    <body>
      <Outlet />
      <Toaster richColors />
      <TanStackRouterDevtools position="bottom-left" />
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRoute({
  server: {
    middleware: [createMiddleware().server(evlogErrorHandler)],
  },

  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Functhis Console' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),

  component: RootDocument,
});
