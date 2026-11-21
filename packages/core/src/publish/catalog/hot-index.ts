export const packageFunctionIdPrefix = (
  handle: string,
  packageSlug: string
): string => `@${handle}/${packageSlug}/`;

export const packageFunctionIdPrefixes = (
  handles: readonly string[],
  packageSlug: string
): string[] =>
  handles.map((handle) => packageFunctionIdPrefix(handle, packageSlug));

/** Drop function ids for a package across all handle prefixes (org slug and owner handle). */
export const stripPackageFunctionIds = (
  ids: readonly string[],
  handles: readonly string[],
  packageSlug: string
): string[] => {
  const prefixes = packageFunctionIdPrefixes(handles, packageSlug);
  return ids.filter((id) => !prefixes.some((prefix) => id.startsWith(prefix)));
};
