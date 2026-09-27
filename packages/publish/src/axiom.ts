import { resolveSecret } from '@functhis/db';
import type { SecretBinding } from '@functhis/db';

import { redactTelemetry } from './telemetry-redaction';

export const AXIOM_MAX_INPUT_BYTES = 32_768;
export const AXIOM_MAX_OUTPUT_BYTES = 32_768;
export const AXIOM_MAX_LOGS = 200;
export const AXIOM_MAX_LOG_BYTES = 2048;

export interface AxiomBindings {
  AXIOM_API_TOKEN?: SecretBinding;
  AXIOM_DATASET?: string;
}

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
    await fetch(
      `https://api.axiom.co/v1/datasets/${encodeURIComponent(axiom.dataset)}/ingest`,
      {
        body: JSON.stringify(events),
        headers: axiomHeaders(axiom.token),
        method: 'POST',
      }
    );
  } catch {
    // Telemetry must never affect execution.
  }
};

export const queryAxiom = async <T = unknown>(
  bindings: AxiomBindings,
  apl: string,
  windowDays = 1
): Promise<T | null> => {
  const axiom = await resolveAxiomBindings(bindings);
  if (!axiom) {
    return null;
  }
  try {
    const response = await fetch('https://api.axiom.co/v1/datasets/_apl', {
      body: JSON.stringify({
        apl,
        datasets: [axiom.dataset],
        endTime: new Date().toISOString(),
        startTime: new Date(Date.now() - windowDays * 86_400_000).toISOString(),
      }),
      headers: axiomHeaders(axiom.token),
      method: 'POST',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const buildExecutionEvent = (input: {
  executionId: string;
  functionSlug?: string;
  input: unknown;
  organizationId: string;
  output: unknown;
  secretValues?: readonly string[];
  status: string;
  versionId: string;
}): Record<string, unknown> => ({
  executionId: input.executionId,
  functionSlug: input.functionSlug ?? '',
  input: redactTelemetry(input.input, input.secretValues),
  organizationId: input.organizationId,
  output: redactTelemetry(input.output, input.secretValues),
  status: input.status,
  versionId: input.versionId,
});

export const readAxiomQueryRecords = (
  result: unknown
): Record<string, unknown>[] => {
  if (Array.isArray(result)) {
    return result.filter(
      (record): record is Record<string, unknown> =>
        typeof record === 'object' && record !== null
    );
  }
  if (typeof result !== 'object' || result === null) {
    return [];
  }
  const value = result as { data?: unknown; matches?: unknown; rows?: unknown };
  for (const candidate of [value.data, value.matches, value.rows]) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (record): record is Record<string, unknown> =>
          typeof record === 'object' && record !== null
      );
    }
  }
  return [];
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
