import { describe, expect, it } from 'bun:test';

import {
  CONSENT_CLOSE_DELAY_SECONDS,
  consentCloseCountdownCopy,
  consentRedirectUrl,
  decideConsentRedirect,
  isLoopbackRedirectUrl,
  suppressClientRedirect,
} from './consent-redirect';

describe('isLoopbackRedirectUrl', () => {
  it('accepts loopback http callbacks', () => {
    expect(
      isLoopbackRedirectUrl('http://127.0.0.1:56250/callback?code=abc')
    ).toBe(true);
    expect(isLoopbackRedirectUrl('http://localhost:8080/callback')).toBe(true);
    expect(isLoopbackRedirectUrl('http://[::1]/callback')).toBe(true);
  });

  it('rejects non-loopback and non-http URLs', () => {
    expect(isLoopbackRedirectUrl('https://functhis.now/')).toBe(false);
    expect(isLoopbackRedirectUrl('ftp://127.0.0.1/callback')).toBe(false);
    expect(isLoopbackRedirectUrl('not a url')).toBe(false);
  });
});

describe('decideConsentRedirect', () => {
  it('stays on the page and delivers loopback callbacks', () => {
    expect(
      decideConsentRedirect('http://127.0.0.1:56250/callback?code=abc')
    ).toEqual({
      deliverUrl: 'http://127.0.0.1:56250/callback?code=abc',
      kind: 'stay',
    });
  });

  it('leaves for remote http(s) redirects', () => {
    expect(decideConsentRedirect('https://client.example/cb?code=abc')).toEqual(
      {
        kind: 'leave',
        url: 'https://client.example/cb?code=abc',
      }
    );
  });

  it('stays when there is no usable redirect', () => {
    expect(decideConsentRedirect()).toEqual({ kind: 'stay' });
    expect(decideConsentRedirect('ftp://client.example/cb')).toEqual({
      kind: 'stay',
    });
  });
});

describe('consentRedirectUrl', () => {
  it('reads url or redirect_uri from the consent payload', () => {
    expect(
      consentRedirectUrl({ redirect: true, url: 'http://127.0.0.1/cb' })
    ).toBe('http://127.0.0.1/cb');
    expect(
      consentRedirectUrl({ redirect_uri: 'https://client.example/cb' })
    ).toBe('https://client.example/cb');
    expect(consentRedirectUrl(null)).toBeUndefined();
  });
});

describe('suppressClientRedirect', () => {
  it('clears the redirect flag so the auth client does not navigate away', () => {
    const data = { redirect: true, url: 'http://127.0.0.1/cb' };
    suppressClientRedirect(data);
    expect(data.redirect).toBe(false);
  });
});

describe('consentCloseCountdownCopy', () => {
  it('counts down then tells the user to close the tab', () => {
    expect(consentCloseCountdownCopy(CONSENT_CLOSE_DELAY_SECONDS)).toBe(
      'This page will try to close in 5 seconds.'
    );
    expect(consentCloseCountdownCopy(1)).toBe(
      'This page will try to close in 1 second.'
    );
    expect(consentCloseCountdownCopy(0)).toBe(
      'This tab is still open. You can close it yourself.'
    );
  });
});
