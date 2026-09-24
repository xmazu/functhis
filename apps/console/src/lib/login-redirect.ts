import { redirect } from '@tanstack/react-router';

import { safeCallbackURL } from '@/lib/safe-callback-url';

/** Relative path + query for login callbacks (router `location.search` is parsed, not a string). */
export const callbackURLFromLocation = (location: {
  href: string;
  pathname: string;
}): string => {
  const pathAndQuery = location.href.startsWith('/')
    ? location.href
    : location.pathname;
  const withoutHash = pathAndQuery.split('#')[0] ?? '/';
  return safeCallbackURL(withoutHash);
};

export const redirectToLogin = (callbackURL: string) => {
  const safe = safeCallbackURL(callbackURL);
  const query = safe === '/' ? '' : `?callbackURL=${encodeURIComponent(safe)}`;
  return redirect({ href: `/login${query}` });
};

export const redirectToLoginFromLocation = (location: {
  href: string;
  pathname: string;
}) => redirectToLogin(callbackURLFromLocation(location));
