import { signedOAuthQueryFromSearch } from './signed-oauth-query';

export interface ConsentRequestBody {
  accept: boolean;
  oauth_query?: string;
  scope?: string;
}

export const consentRequest = ({
  accept,
  oauthQuery,
  scope,
}: {
  accept: boolean;
  oauthQuery?: string;
  scope?: string;
}): ConsentRequestBody => {
  const body: ConsentRequestBody = { accept };
  if (oauthQuery) {
    body.oauth_query = oauthQuery;
  }
  if (accept && scope) {
    body.scope = scope;
  }
  return body;
};

/** Signed authorize params from the consent page URL (must include `sig`). */
export const consentOAuthQueryFromLocation = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return signedOAuthQueryFromSearch(window.location.search);
};
