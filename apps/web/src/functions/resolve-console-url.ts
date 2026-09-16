import { createIsomorphicFn } from '@tanstack/react-start';

import { env } from '#/env.server';

import { getConsoleUrl } from './get-console-url';

/** Console URL for layout — reads bindings on SSR, RPC from the browser. */
export const resolveConsoleUrl = createIsomorphicFn()
  .server(() => env.CONSOLE_URL)
  .client(() => getConsoleUrl());
