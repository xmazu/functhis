const MAX_METADATA_BYTES = 5 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

const SPECIAL_USE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^198\.1[89]\./,
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^224\./,
  /^240\./,
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

function isSpecialUseIpv4(hostname: string): boolean {
  return SPECIAL_USE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname));
}

function isSpecialUseIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('100::')
  );
}

export function validateCimdUrl(url: string): URL {
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
}

async function readLimitedBody(response: Response): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    return new ArrayBuffer(0);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    total += value.byteLength;
    if (total > MAX_METADATA_BYTES) {
      throw new Error('CIMD metadata response exceeds size limit');
    }

    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged.buffer;
}

export async function fetchClientMetadataResource(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
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
      redirect: 'error',
      signal: init?.signal ?? controller.signal,
    });

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
}
