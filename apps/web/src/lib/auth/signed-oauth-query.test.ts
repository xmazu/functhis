import { describe, expect, it } from 'bun:test';

import { signedOAuthQueryFromSearch } from './signed-oauth-query';

describe('signedOAuthQueryFromSearch', () => {
  it('keeps only parameters covered by ba_param and sig', () => {
    const search =
      '?response_type=code&client_id=https%3A%2F%2Fclient.example&state=s&sig=signed&exp=9&ba_iat=1&ba_param=ba_iat&ba_param=client_id&ba_param=response_type&ba_param=sig&ba_param=state&extra=drop';

    const query = signedOAuthQueryFromSearch(search);

    expect(query).toContain('client_id=');
    expect(query).toContain('sig=signed');
    expect(query).toContain('ba_iat=1');
    expect(query).not.toContain('extra=drop');
    expect(query).not.toContain('exp=9');
  });

  it('returns undefined when sig or ba_param is missing', () => {
    expect(signedOAuthQueryFromSearch('?client_id=x')).toBeUndefined();
    expect(signedOAuthQueryFromSearch('?sig=x')).toBeUndefined();
  });
});
