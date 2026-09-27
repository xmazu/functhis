/** Signed-in package console routes at /@handle/slug (not the /d workspace list). */
export const isPackageConsolePath = (pathname: string): boolean =>
  pathname.startsWith('/@');
