export interface ParsedFunctionId {
  functionSlug: string;
  handle: string;
  packageSlug: string;
}

const FUNCTION_SLUG_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const isValidFunctionSlug = (slug: string): boolean => {
  if (slug.length === 0 || slug.length > 256) {
    return false;
  }
  const segments = slug.split('/');
  return segments.every((segment) => FUNCTION_SLUG_SEGMENT.test(segment));
};

export const formatFunctionId = (input: {
  functionSlug: string;
  handle: string;
  packageSlug: string;
}): string => `@${input.handle}/${input.packageSlug}/${input.functionSlug}`;

export const parseFunctionId = (id: string): ParsedFunctionId | null => {
  const trimmed = id.trim();
  const match =
    /^@(?<handle>[^/]+)\/(?<packageSlug>[^/]+)\/(?<functionSlug>.+)$/u.exec(
      trimmed
    );
  if (!match?.groups) {
    return null;
  }
  const { functionSlug, handle, packageSlug } = match.groups;
  if (!handle || !packageSlug || !functionSlug) {
    return null;
  }
  if (!isValidFunctionSlug(functionSlug)) {
    return null;
  }
  return { functionSlug, handle, packageSlug };
};
