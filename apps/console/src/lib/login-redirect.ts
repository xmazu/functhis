import { redirect } from '@tanstack/react-router';

import { safeCallbackURL } from '@/lib/safe-callback-url';

export const redirectToLogin = (callbackURL: string) =>
  redirect({
    search: { callbackURL: safeCallbackURL(callbackURL) },
    to: '/login',
  });
