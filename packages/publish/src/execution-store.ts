import { createDb } from '@functhis/db';
import type { DatabaseConfig } from '@functhis/db';
import { execution } from '@functhis/db/schema/catalog';
import { eq } from 'drizzle-orm';

/** Update the running row when present; otherwise insert a completed row. */
export const insertExecutionRow = async (
  bindings: DatabaseConfig,
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
    const database = await createDb(bindings);
    const updated = await database
      .update(execution)
      .set({
        callerUserId: input.callerUserId ?? null,
        completedAt: input.completedAt,
        cpuMs: input.cpuMs,
        functionId: input.functionId,
        packageVersionId: input.packageVersionId,
        requestBytes: input.requestBytes,
        responseBytes: input.responseBytes,
        startedAt: input.startedAt,
        status: input.status,
      })
      .where(eq(execution.id, input.executionId))
      .returning({ id: execution.id });
    if (updated.length > 0) {
      return;
    }
    await database.insert(execution).values({
      callerUserId: input.callerUserId ?? null,
      completedAt: input.completedAt,
      cpuMs: input.cpuMs,
      functionId: input.functionId,
      id: input.executionId,
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
  bindings: DatabaseConfig,
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
    const database = await createDb(bindings);
    await database.insert(execution).values({
      callerUserId: input.callerUserId ?? null,
      functionId: input.functionId,
      id: input.executionId,
      organizationId: input.organizationId,
      packageVersionId: input.packageVersionId,
      requestBytes: input.requestBytes,
      startedAt: input.startedAt,
      status: 'running',
    });
  } catch {
    // Best-effort execution row.
  }
};
