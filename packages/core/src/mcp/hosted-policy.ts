import type { PackageVisibility } from '../publish/catalog/package-visibility';
import type { HotKvBinding } from '../publish/http/http-context';

export interface PackageAccessContext {
  organizationIds: readonly string[];
  userId: string | null;
}

export interface PackageAccessRow {
  organizationId: string | null;
  ownerUserId: string;
  visibility: PackageVisibility;
}

/** Hosted product policy wired by apps/mcp from `@functhis/platform`. */
export interface McpHostedPolicy {
  buildAccessContext: (
    hot: HotKvBinding,
    callerUserId: string | null
  ) => Promise<PackageAccessContext>;
  canAccessPackage: (
    row: PackageAccessRow,
    context: PackageAccessContext
  ) => boolean;
  reserveExecution: (organizationId: string) => Promise<void>;
  isQuotaExceeded: (error: unknown) => boolean;
  quotaErrorMessage: (error: unknown) => string;
  resolveFinalizeTelemetry: (input: {
    organizationId: string;
  }) => Promise<{ emitTelemetry: boolean }>;
}
