/** Mirrors `@better-auth/oauth-provider` signed-query (not exported from `/client`). */
const signedQueryParameterNameParam = 'ba_param';

export const signedOAuthQueryFromSearch = (
  search: string
): string | undefined => {
  const params = new URLSearchParams(search);
  if (!params.has('sig')) {
    return undefined;
  }

  const signedParameterNames = new Set(
    params.getAll(signedQueryParameterNameParam)
  );
  if (signedParameterNames.size === 0) {
    return undefined;
  }

  const signedParams = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (
      key === 'sig' ||
      key === signedQueryParameterNameParam ||
      signedParameterNames.has(key)
    ) {
      signedParams.append(key, value);
    }
  }

  const query = signedParams.toString();
  return query.length > 0 ? query : undefined;
};
