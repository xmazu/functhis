/** Signed-in dashboard routes that do not require a workspace org yet. */
export const isDashboardBootstrapPath = (pathname: string): boolean =>
  pathname === '/d/onboard' || pathname.startsWith('/d/accept-invitation/');
