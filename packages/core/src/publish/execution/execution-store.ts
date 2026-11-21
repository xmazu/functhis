import type { ExecutionLogPort } from '../ports';
import type { ExecutionLabels } from './labels';

/** Update the running row when present; otherwise insert a completed row. */
export const insertExecutionRow = async (
  executionLog: ExecutionLogPort,
  input: {
    actorId?: string | null;
    completedAt: Date;
    cpuMs: number;
    executionId: string;
    functionId?: string;
    labels: ExecutionLabels;
    packageVersionId: string;
    requestBytes: number;
    responseBytes: number;
    startedAt: Date;
    status: string;
  }
): Promise<void> => {
  try {
    await executionLog.upsertCompleted({
      actorId: input.actorId,
      completedAt: input.completedAt,
      cpuMs: input.cpuMs,
      executionId: input.executionId,
      functionId: input.functionId,
      labels: input.labels,
      packageVersionId: input.packageVersionId,
      requestBytes: input.requestBytes,
      responseBytes: input.responseBytes,
      startedAt: input.startedAt,
      status: input.status,
    });
  } catch {
    // Best-effort execution row (MCP finalize must not fail).
  }
};

export const insertStartedExecutionRow = async (
  executionLog: ExecutionLogPort,
  input: {
    actorId?: string | null;
    executionId: string;
    functionId?: string;
    labels: ExecutionLabels;
    packageVersionId: string;
    requestBytes: number;
    startedAt: Date;
  }
): Promise<void> => {
  try {
    await executionLog.insertStarted({
      actorId: input.actorId,
      executionId: input.executionId,
      functionId: input.functionId,
      labels: input.labels,
      packageVersionId: input.packageVersionId,
      requestBytes: input.requestBytes,
      startedAt: input.startedAt,
    });
  } catch {
    // Best-effort execution row.
  }
};
