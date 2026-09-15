import { createServerFn } from '@tanstack/react-start';

import { env } from '../env.server';

export const getConsoleUrl = createServerFn({ method: 'GET' }).handler(
  () => env.CONSOLE_URL
);
