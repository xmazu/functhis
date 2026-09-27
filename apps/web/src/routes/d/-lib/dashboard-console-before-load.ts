import { redirect } from '@tanstack/react-router';

import { userHasOrganization } from '#/functions/has-organization';
import { resolveSession } from '#/functions/resolve-session';
import {
  callbackURLFromLocation,
  redirectToLogin,
} from '#/lib/auth/login-redirect';

import { isDashboardBootstrapPath } from './dashboard-bootstrap-path';

/** Session + workspace org gate shared by /d and /@ package console layouts. */
export const dashboardConsoleBeforeLoad = async ({
  location,
}: {
  location: { href: string; pathname: string };
}) => {
  const callbackURL = callbackURLFromLocation(location);
  const session = await resolveSession();
  if (!session) {
    throw redirectToLogin(callbackURL);
  }

  const bootstrap = isDashboardBootstrapPath(location.pathname);
  const acceptInvitationOnly =
    bootstrap && location.pathname.startsWith('/d/accept-invitation/');

  if (acceptInvitationOnly) {
    return { session };
  }

  const hasOrg = await userHasOrganization();

  if (!hasOrg && !bootstrap) {
    throw redirect({ to: '/d/onboard' });
  }

  if (hasOrg && bootstrap) {
    throw redirect({ to: '/d' });
  }

  return { session };
};
