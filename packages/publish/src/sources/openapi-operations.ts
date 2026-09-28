import { sha256Hex } from '../bundle';

export interface OpenApiOperation {
  description: string;
  method: string;
  operationId: string;
  path: string;
  requestSchema: Record<string, unknown>;
  summary?: string;
}

const httpMethods = ['get', 'put', 'post', 'delete', 'patch', 'head'] as const;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

export const openApiServerUrl = (spec: Record<string, unknown>): string => {
  const { servers } = spec;
  if (Array.isArray(servers) && servers[0] && typeof servers[0] === 'object') {
    const { url } = servers[0] as { url?: unknown };
    if (typeof url === 'string' && url.length > 0) {
      return url.replace(/\/$/u, '');
    }
  }
  return '';
};

export const extractOpenApiOperations = (
  spec: Record<string, unknown>
): OpenApiOperation[] => {
  const paths = asRecord(spec.paths) ?? {};
  const operations: OpenApiOperation[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    const item = asRecord(pathItem);
    if (!item) {
      continue;
    }
    for (const method of httpMethods) {
      const operation = asRecord(item[method]);
      if (!operation) {
        continue;
      }
      const operationId =
        typeof operation.operationId === 'string' &&
        operation.operationId.length > 0
          ? operation.operationId
          : `${method}-${path.replaceAll(/[^a-zA-Z0-9]+/gu, '-')}`;
      const description =
        (typeof operation.description === 'string' && operation.description) ||
        (typeof operation.summary === 'string' && operation.summary) ||
        operationId;
      operations.push({
        description,
        method,
        operationId: operationId
          .replaceAll(/[^a-zA-Z0-9/]+/gu, '-')
          .replaceAll(/^-+|-+$/gu, '')
          .toLowerCase(),
        path,
        requestSchema: {
          additionalProperties: true,
          type: 'object',
        },
        summary:
          typeof operation.summary === 'string' ? operation.summary : undefined,
      });
    }
  }
  return operations;
};

export const hashOpenApiSpec = (
  spec: Record<string, unknown>
): Promise<string> => sha256Hex(JSON.stringify(spec));
