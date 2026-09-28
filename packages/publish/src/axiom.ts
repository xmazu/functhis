import { resolveSecret } from '@functhis/db';
import type { SecretBinding } from '@functhis/db';

import { withTelemetryIndexFields } from './axiom-apl';
import { redactTelemetry } from './telemetry-redaction';

export const AXIOM_MAX_INPUT_BYTES = 32_768;
export const AXIOM_MAX_OUTPUT_BYTES = 32_768;
export const AXIOM_MAX_LOGS = 200;
export const AXIOM_MAX_LOG_BYTES = 2048;

export interface AxiomBindings {
  AXIOM_API_TOKEN?: SecretBinding;
  /** Edge host, e.g. `eu-central-1.aws.edge.axiom.co` (see Axiom edge deployments). */
  AXIOM_EDGE?: string;
  /** Full edge origin, e.g. `https://eu-central-1.aws.edge.axiom.co`. */
  AXIOM_EDGE_URL?: string;
  AXIOM_DATASET?: string;
}

const normalizeEdgeHost = (value: string): string =>
  value.replace(/^https?:\/\//u, '').replace(/\/$/u, '');

export const resolveAxiomEdgeOrigin = (
  bindings: Pick<AxiomBindings, 'AXIOM_EDGE' | 'AXIOM_EDGE_URL'>
): string | null => {
  const url = bindings.AXIOM_EDGE_URL?.trim();
  if (url) {
    return url.replace(/\/$/u, '');
  }
  const edge = bindings.AXIOM_EDGE?.trim();
  if (edge) {
    return `https://${normalizeEdgeHost(edge)}`;
  }
  return null;
};

export const buildAxiomIngestUrl = (
  dataset: string,
  bindings: Pick<AxiomBindings, 'AXIOM_EDGE' | 'AXIOM_EDGE_URL'>
): string => {
  const origin = resolveAxiomEdgeOrigin(bindings);
  if (origin) {
    return `${origin}/v1/ingest/${encodeURIComponent(dataset)}`;
  }
  return `https://api.axiom.co/v1/datasets/${encodeURIComponent(dataset)}/ingest`;
};

/** Central query API can read edge-ingested datasets; edge `/v1/query/_apl` is easy to mis-route. */
export const buildAxiomQueryUrl = (): string =>
  'https://api.axiom.co/v1/datasets/_apl?format=tabular';

export const buildAxiomEdgeQueryUrl = (
  bindings: Pick<AxiomBindings, 'AXIOM_EDGE' | 'AXIOM_EDGE_URL'>
): string | null => {
  const origin = resolveAxiomEdgeOrigin(bindings);
  return origin ? `${origin}/v1/query/_apl?format=tabular` : null;
};

const scopeAxiomApl = (dataset: string, apl: string): string => {
  const trimmed = apl.trim();
  if (trimmed.startsWith('[')) {
    return trimmed;
  }
  const escapedDataset = dataset.replaceAll("'", "\\'");
  return `['${escapedDataset}'] | ${trimmed}`;
};

export const resolveAxiomBindings = async (
  bindings: AxiomBindings
): Promise<{ dataset: string; token: string } | null> => {
  if (!bindings.AXIOM_API_TOKEN || !bindings.AXIOM_DATASET) {
    return null;
  }
  try {
    const token = await resolveSecret(bindings.AXIOM_API_TOKEN);
    return { dataset: bindings.AXIOM_DATASET, token };
  } catch {
    return null;
  }
};

const axiomHeaders = (token: string): HeadersInit => ({
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

export const ingestAxiomEvents = async (
  bindings: AxiomBindings,
  events: readonly Record<string, unknown>[]
): Promise<void> => {
  if (events.length === 0) {
    return;
  }
  const axiom = await resolveAxiomBindings(bindings);
  if (!axiom) {
    return;
  }
  try {
    const response = await fetch(buildAxiomIngestUrl(axiom.dataset, bindings), {
      body: JSON.stringify(events),
      headers: axiomHeaders(axiom.token),
      method: 'POST',
    });
    if (!response.ok) {
      // Swallow ingest failures; execution must not depend on telemetry.
    }
  } catch {
    // Telemetry must never affect execution.
  }
};

const runAxiomQuery = async <T>(
  url: string,
  axiom: { dataset: string; token: string },
  apl: string,
  windowDays: number,
  window?: { endTime?: Date; startTime?: Date }
): Promise<T | null> => {
  const response = await fetch(url, {
    body: JSON.stringify({
      apl: scopeAxiomApl(axiom.dataset, apl),
      datasets: [axiom.dataset],
      endTime: (window?.endTime ?? new Date()).toISOString(),
      startTime: (
        window?.startTime ?? new Date(Date.now() - windowDays * 86_400_000)
      ).toISOString(),
    }),
    headers: axiomHeaders(axiom.token),
    method: 'POST',
  });
  if (!response.ok) {
    if (process.env.NODE_ENV === 'development') {
      const body = await response.text();
      console.error(
        '[functhis:axiom] query failed',
        response.status,
        url,
        body.slice(0, 400)
      );
    }
    return null;
  }
  return (await response.json()) as T;
};

export const queryAxiom = async <T = unknown>(
  bindings: AxiomBindings,
  apl: string,
  windowDays = 1,
  window?: { endTime?: Date; startTime?: Date }
): Promise<T | null> => {
  const axiom = await resolveAxiomBindings(bindings);
  if (!axiom) {
    return null;
  }
  try {
    const primary = await runAxiomQuery<T>(
      buildAxiomQueryUrl(),
      axiom,
      apl,
      windowDays,
      window
    );
    if (primary !== null) {
      return primary;
    }
    const edgeUrl = buildAxiomEdgeQueryUrl(bindings);
    if (!edgeUrl) {
      return null;
    }
    return await runAxiomQuery<T>(edgeUrl, axiom, apl, windowDays, window);
  } catch {
    return null;
  }
};

export const buildExecutionEvent = (input: {
  executionId: string;
  functionSlug?: string;
  handle?: string;
  input: unknown;
  organizationId: string;
  output: unknown;
  packageSlug?: string;
  secretValues?: readonly string[];
  status: string;
  versionId: string;
}): Record<string, unknown> =>
  withTelemetryIndexFields({
    executionId: input.executionId,
    functionSlug: input.functionSlug ?? '',
    handle: input.handle ?? '',
    input: redactTelemetry(input.input, input.secretValues),
    organizationId: input.organizationId,
    output: redactTelemetry(input.output, input.secretValues),
    packageSlug: input.packageSlug ?? '',
    status: input.status,
    timestamp: new Date().toISOString(),
    type: 'execution',
    versionId: input.versionId,
  });

const serializeLogValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
};

const capLogMessage = (prefix: string, value: unknown): string => {
  const message = `${prefix}${serializeLogValue(value)}`;
  return message.length <= AXIOM_MAX_LOG_BYTES
    ? message
    : message.slice(0, AXIOM_MAX_LOG_BYTES);
};

const laterTimestamp = (startedAt: string, completedAt: string): string => {
  if (completedAt > startedAt) {
    return completedAt;
  }
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) {
    return completedAt;
  }
  return new Date(started + 1).toISOString();
};

export const buildExecutionLifecycleLogs = (input: {
  completedAt: string;
  executionId: string;
  functionSlug?: string;
  handle?: string;
  input: unknown;
  organizationId: string;
  output: unknown;
  packageSlug?: string;
  startedAt: string;
  status: string;
  versionId: string;
}): Record<string, unknown>[] => {
  const shared = {
    executionId: input.executionId,
    functionSlug: input.functionSlug ?? '',
    handle: input.handle ?? '',
    organizationId: input.organizationId,
    packageSlug: input.packageSlug ?? '',
    versionId: input.versionId,
  };
  return [
    withTelemetryIndexFields({
      ...shared,
      level: 'info',
      message: capLogMessage('started with ', input.input),
      timestamp: input.startedAt,
      type: 'log',
    }),
    withTelemetryIndexFields({
      ...shared,
      level: input.status === 'ok' ? 'info' : 'error',
      message: capLogMessage('produced ', input.output),
      timestamp: laterTimestamp(input.startedAt, input.completedAt),
      type: 'log',
    }),
  ];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const recordsFromList = (value: unknown): Record<string, unknown>[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((record) => isRecord(record));
};

const recordsFromTabular = (
  tables: unknown
): Record<string, unknown>[] | null => {
  if (!Array.isArray(tables)) {
    return null;
  }
  const records: Record<string, unknown>[] = [];
  for (const table of tables) {
    if (!isRecord(table)) {
      continue;
    }
    const { fields } = table;
    const { columns } = table;
    if (!(Array.isArray(fields) && Array.isArray(columns))) {
      continue;
    }
    const names = fields.map((field) =>
      isRecord(field) && typeof field.name === 'string' ? field.name : ''
    );
    const [firstColumn] = columns;
    const rowCount = Array.isArray(firstColumn) ? firstColumn.length : 0;
    for (let row = 0; row < rowCount; row += 1) {
      const record: Record<string, unknown> = {};
      for (const [columnIndex, name] of names.entries()) {
        if (!name) {
          continue;
        }
        const column = columns[columnIndex];
        record[name] = Array.isArray(column) ? column[row] : undefined;
      }
      records.push(record);
    }
  }
  return records.length > 0 ? records : null;
};

export const readAxiomQueryRecords = (
  result: unknown
): Record<string, unknown>[] => {
  if (Array.isArray(result)) {
    return result.filter(
      (record): record is Record<string, unknown> =>
        typeof record === 'object' && record !== null
    );
  }
  if (!isRecord(result)) {
    return [];
  }
  for (const candidate of [result.data, result.matches, result.rows]) {
    const records = recordsFromList(candidate);
    if (records && records.length > 0) {
      return records;
    }
  }
  return recordsFromTabular(result.tables) ?? [];
};

export const capTelemetryValue = (
  value: unknown,
  maxBytes: number
): unknown => {
  const serialized = JSON.stringify(value);
  if (
    !serialized ||
    new TextEncoder().encode(serialized).byteLength <= maxBytes
  ) {
    return value;
  }
  return { truncated: true };
};
