import type { FuncthisApi } from './next';
import { API_PREFIX } from './protocol';
import type { FuncthisCallable } from './protocol';

type InferInput<F> = F extends (input: infer I) => unknown ? I : never;

type InferOutput<F> = F extends (...args: never[]) => Promise<infer O>
  ? O
  : F extends (...args: never[]) => infer O
    ? O
    : never;

type FunctionMapOf<Api> = Api extends FuncthisApi<infer T> ? T : never;

export type FuncthisClient<
  Api extends FuncthisApi<Record<string, FuncthisCallable>>,
> = {
  [K in keyof FunctionMapOf<Api> & string]: (
    input: InferInput<FunctionMapOf<Api>[K]>
  ) => Promise<InferOutput<FunctionMapOf<Api>[K]>>;
};

const REQUEST_TIMEOUT_MS = 10_000;

export const createClient = <
  Api extends FuncthisApi<Record<string, FuncthisCallable>>,
>(options: {
  token: string;
  url: string;
}): FuncthisClient<Api> => {
  const baseUrl = options.url.trim();
  const token = options.token.trim();

  if (!baseUrl) {
    throw new Error('url must not be empty');
  }
  if (!token) {
    throw new Error('token must not be empty');
  }

  const invoke = async <TOutput>(
    slug: string,
    input: unknown
  ): Promise<TOutput> => {
    let endpoint: URL;
    try {
      endpoint = new URL(`${API_PREFIX}/${slug}`, baseUrl);
    } catch {
      throw new Error('url must be a valid absolute URL');
    }

    const response = await fetch(endpoint, {
      body: JSON.stringify(input),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    let body: { error?: string } | TOutput;
    try {
      body = (await response.json()) as { error?: string } | TOutput;
    } catch {
      if (response.ok) {
        throw new Error('Functhis response was not valid JSON');
      }
      body = {};
    }

    if (!response.ok) {
      const message =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
          ? body.error
          : `Functhis request failed with status ${response.status}`;

      throw new Error(message);
    }

    return body as TOutput;
  };

  return new Proxy({} as FuncthisClient<Api>, {
    get(_target, property) {
      if (typeof property !== 'string') {
        return;
      }
      return (input: unknown) => invoke(property, input);
    },
  });
};
