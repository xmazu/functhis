import { redirect } from '@tanstack/react-router';

import { safeCallbackURL } from '@/lib/safe-callback-url';

export const redirectToLogin = (callbackURL: string) => {
  const safe = safeCallbackURL(callbackURL);
  const query = safe === '/' ? '' : `?callbackURL=${encodeURIComponent(safe)}`;
  return redirect({ href: `/login${query}` });
};
