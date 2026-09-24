export const PUBLIC_PATH =
  /^\/@(?<handle>[^/]+)\/(?<package>[^/]+)(?:\/(?<function>.+?))?\/?$/u;

export interface PublicPathParams {
  functionSlug?: string;
  handle: string;
  packageSlug: string;
}

export const matchPublicPath = (pathname: string): PublicPathParams | null => {
  const match = PUBLIC_PATH.exec(pathname);
  if (!match?.groups) {
    return null;
  }

  const { function: functionSlug, handle, package: packageSlug } = match.groups;
  if (!handle || !packageSlug) {
    return null;
  }

  return {
    functionSlug,
    handle,
    packageSlug,
  };
};
