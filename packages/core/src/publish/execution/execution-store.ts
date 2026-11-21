import type { ExecutionLogPort } from '../ports';

/** Update the running row when present; otherwise insert a completed row. */
export const insertExecutionRow = async (
  executionLog: ExecutionLogPort,
  input: {
    callerUserId?: string | null;
    cpuMs: number;
    completedAt: Date;
    executionId: string;
    functionId?: string;
    organizationId: string;
    packageVersionId: string;
    requestBytes: number;
    responseBytes: number;
    startedAt: Date;
    status: string;
  }
): Promise<void> => {
  try {
    await executionLog.upsertCompleted({
      callerUserId: input.callerUserId,
      completedAt: input.completedAt,
      cpuMs: input.cpuMs,
      executionId: input.executionId,
      functionId: input.functionId,
      organizationId: input.organizationId,
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
    callerUserId?: string | null;
    executionId: string;
    functionId?: string;
    organizationId: string;
    packageVersionId: string;
    requestBytes: number;
    startedAt: Date;
  }
): Promise<void> => {
  try {
    await executionLog.insertStarted({
      callerUserId: input.callerUserId,
      executionId: input.executionId,
      functionId: input.functionId,
      organizationId: input.organizationId,
      packageVersionId: input.packageVersionId,
      requestBytes: input.requestBytes,
      startedAt: input.startedAt,
    });
  } catch {
    // Best-effort execution row.
  }
};
