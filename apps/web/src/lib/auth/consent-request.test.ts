import { describe, expect, it } from 'bun:test';

import { consentRequest } from './consent-request';

describe('consentRequest', () => {
  it('forwards the signed oauth_query from the consent redirect', () => {
    const oauthQuery =
      'client_id=test&sig=abc&ba_param=client_id&ba_param=sig&ba_iat=1';

    const body = consentRequest({
      accept: true,
      oauthQuery,
      scope: 'openid profile email offline_access',
    });

    expect(body).toEqual({
      accept: true,
      oauth_query: oauthQuery,
      scope: 'openid profile email offline_access',
    });
  });

  it('does not invent oauth_query when none was provided', () => {
    const body = consentRequest({ accept: false });

    expect(body).toEqual({ accept: false });
    expect(body).not.toHaveProperty('oauth_query');
    expect(body).not.toHaveProperty('scope');
  });
});
