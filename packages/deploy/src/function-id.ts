export interface ParsedFunctionId {
  functionSlug: string;
  handle: string;
  packageSlug: string;
}

export const formatFunctionId = (input: {
  functionSlug: string;
  handle: string;
  packageSlug: string;
}): string => `@${input.handle}/${input.packageSlug}/${input.functionSlug}`;

export const parseFunctionId = (id: string): ParsedFunctionId | null => {
  const trimmed = id.trim();
  const match =
    /^@(?<handle>[^/]+)\/(?<packageSlug>[^/]+)\/(?<functionSlug>[^/]+)$/u.exec(
      trimmed
    );
  if (!match?.groups) {
    return null;
  }
  const { functionSlug, handle, packageSlug } = match.groups;
  if (!handle || !packageSlug || !functionSlug) {
    return null;
  }
  return { functionSlug, handle, packageSlug };
};
