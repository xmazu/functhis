import type { ExecutionLogPort } from '@functhis/core/publish/ports';

import { eq } from '../drizzle';
import type { Database } from '../index';
import { execution } from '../schema/catalog';

export const createExecutionLogPort = (
  database: Database
): ExecutionLogPort => ({
  async insertStarted(input) {
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
  },

  async upsertCompleted(input) {
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
  },
});
