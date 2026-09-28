import type { AxiomBindings } from './axiom';
import {
  queryAxiom,
  readAxiomQueryRecords,
  resolveAxiomBindings,
} from './axiom';
import { aplJsonFieldSearch, aplSearch } from './axiom-apl';

export type AxiomLogsQueryResult =
  | { kind: 'not_configured' }
  | { kind: 'query_failed' }
  | { kind: 'ok'; records: Record<string, unknown>[] };

export interface AxiomLogQuery {
  cursor?: string;
  endTime?: Date;
  executionId?: string;
  functionSlug?: string;
  handle?: string;
  level?: readonly string[];
  limit?: number;
  message?: string;
  organizationId: string;
  packages?: readonly { handle: string; packageSlug: string }[];
  packageSlug?: string;
  startTime?: Date;
}

const quote = (value: string): string => JSON.stringify(value);

export const buildAxiomLogQuery = (input: AxiomLogQuery): string => {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const steps = [aplSearch(input.organizationId)];

  if (input.executionId) {
    steps.push(aplSearch(input.executionId));
  }

  if (input.handle) {
    steps.push(aplJsonFieldSearch('handle', input.handle));
  }
  if (input.packageSlug) {
    steps.push(aplJsonFieldSearch('packageSlug', input.packageSlug));
  }
  if (input.level && input.level.length > 0) {
    for (const level of input.level) {
      steps.push(aplJsonFieldSearch('level', level));
    }
  }
  if (input.functionSlug) {
    steps.push(aplJsonFieldSearch('functionSlug', input.functionSlug));
  }
  if (input.message) {
    steps.push(aplSearch(input.message));
  }

  const filters: string[] = [];
  if (input.cursor) {
    filters.push(`_time < datetime(${quote(input.cursor)})`);
  }

  const filterClause =
    filters.length > 0 ? ` | where ${filters.join(' and ')}` : '';

  return `${steps.join(' | ')}${filterClause} | sort by _time desc | limit ${limit}`;
};

export {
  filterDashboardTelemetryRecords,
  filterTelemetryRecordsByPackages,
} from './axiom-apl';

/* c8 ignore start -- transport behavior is covered by the Axiom integration path. */
export const queryAxiomLogs = async (
  bindings: AxiomBindings,
  input: AxiomLogQuery
): Promise<AxiomLogsQueryResult> => {
  const axiom = await resolveAxiomBindings(bindings);
  if (!axiom) {
    return { kind: 'not_configured' };
  }
  const result = await queryAxiom(bindings, buildAxiomLogQuery(input), 1, {
    endTime: input.endTime,
    startTime: input.startTime,
  });
  if (result === null) {
    return { kind: 'query_failed' };
  }
  return { kind: 'ok', records: readAxiomQueryRecords(result) };
};
/* c8 ignore stop */
