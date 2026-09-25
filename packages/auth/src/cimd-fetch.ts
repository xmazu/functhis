const MAX_METADATA_BYTES = 5 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
/** Workers reject `redirect: "error"`; use manual and treat 3xx as blocked. */
const CIMD_FETCH_REDIRECT = 'manual' as const;

const SPECIAL_USE_IPV4_PATTERNS = [
  /^127\./u,
  /^10\./u,
  /^192\.168\./u,
  /^169\.254\./u,
  /^0\./u,
  /^100\.(?<octet>6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./u,
  /^198\.1[89]\./u,
  /^192\.0\.0\./u,
  /^192\.0\.2\./u,
  /^198\.51\.100\./u,
  /^203\.0\.113\./u,
  /^224\./u,
  /^240\./u,
];

const SPECIAL_USE_HOSTNAMES = new Set([
  'localhost',
  'local',
  'internal',
  'intranet',
  'private',
  'corp',
  'home',
  'lan',
]);

const isSpecialUseIpv4 = (hostname: string): boolean =>
  SPECIAL_USE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname));

const isSpecialUseIpv6 = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('100::')
  );
};

export const validateCimdUrl = (url: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid CIMD URL: ${url}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('CIMD URLs must use HTTPS');
  }

  if (parsed.username || parsed.password) {
    throw new Error('CIMD URLs must not contain credentials');
  }

  if (parsed.hash) {
    throw new Error('CIMD URLs must not contain a fragment');
  }

  if (!parsed.pathname || parsed.pathname === '/') {
    throw new Error('CIMD URLs must include a path component');
  }

  const hostname = parsed.hostname.toLowerCase();

  if (SPECIAL_USE_HOSTNAMES.has(hostname)) {
    throw new Error('CIMD URLs must not target special-use hostnames');
  }

  if (isSpecialUseIpv4(hostname) || isSpecialUseIpv6(hostname)) {
    throw new Error('CIMD URLs must not target special-use addresses');
  }

  return parsed;
};

const mergeChunks = (chunks: Uint8Array[], total: number): ArrayBuffer => {
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged.buffer;
};

const readLimitedBody = (response: Response): Promise<ArrayBuffer> => {
  const reader = response.body?.getReader();
  if (!reader) {
    return Promise.resolve(new ArrayBuffer(0));
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  const readNext = async (): Promise<ArrayBuffer> => {
    const { done, value } = await reader.read();
    if (done) {
      return mergeChunks(chunks, total);
    }

    if (!value) {
      return readNext();
    }

    total += value.byteLength;
    if (total > MAX_METADATA_BYTES) {
      throw new Error('CIMD metadata response exceeds size limit');
    }

    chunks.push(value);
    return readNext();
  };

  return readNext();
};

export const fetchClientMetadataResource = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();
  validateCimdUrl(url);

  const method = init?.method?.toUpperCase() ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    throw new Error('CIMD metadata fetch only supports GET and HEAD');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      method,
      redirect: CIMD_FETCH_REDIRECT,
      signal: init?.signal ?? controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error('CIMD metadata fetch must not follow redirects');
    }

    if (method === 'HEAD') {
      return response;
    }

    const body = await readLimitedBody(response);
    return new Response(body, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  } finally {
    clearTimeout(timeout);
  }
};
