const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export const CONSENT_CLOSE_DELAY_SECONDS = 5;

const isHttpUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

export const isLoopbackRedirectUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    return LOOPBACK_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
};

export const consentRedirectUrl = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.url === 'string') {
    return record.url;
  }
  if (typeof record.redirect_uri === 'string') {
    return record.redirect_uri;
  }
  return undefined;
};

export const suppressClientRedirect = (data: unknown): void => {
  if (!data || typeof data !== 'object' || !('redirect' in data)) {
    return;
  }
  (data as { redirect: boolean }).redirect = false;
};

export type ConsentRedirectDecision =
  | { kind: 'stay'; deliverUrl?: string }
  | { kind: 'leave'; url: string };

export const decideConsentRedirect = (
  url?: string
): ConsentRedirectDecision => {
  if (!url) {
    return { kind: 'stay' };
  }
  if (isLoopbackRedirectUrl(url)) {
    return { deliverUrl: url, kind: 'stay' };
  }
  if (isHttpUrl(url)) {
    return { kind: 'leave', url };
  }
  return { kind: 'stay' };
};

export const deliverLoopbackOAuthRedirect = (url: string): void => {
  if (!isLoopbackRedirectUrl(url) || typeof document === 'undefined') {
    return;
  }
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.hidden = true;
  frame.src = url;
  document.body.append(frame);
  void (async () => {
    try {
      await fetch(url, {
        cache: 'no-store',
        credentials: 'omit',
        mode: 'no-cors',
      });
    } catch {
      // The local callback server only needs the request to arrive.
    }
  })();
};

export const consentCloseCountdownCopy = (secondsLeft: number): string => {
  if (secondsLeft <= 0) {
    return 'This tab is still open. You can close it yourself.';
  }
  const unit = secondsLeft === 1 ? 'second' : 'seconds';
  return `This page will try to close in ${secondsLeft} ${unit}.`;
};
