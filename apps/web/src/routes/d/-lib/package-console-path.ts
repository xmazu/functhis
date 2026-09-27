/** TanStack Router route id for the signed-in package console layout. */
export const packageConsoleRouteId = '/@{$handle}/$slug';

/** Signed-in package console routes at /@handle/slug (not the /d workspace list). */
export const isPackageConsolePath = (pathname: string): boolean =>
  pathname.startsWith('/@');
