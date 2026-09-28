/** APL helpers for Functhis telemetry (ingest JSON + dashboard queries). */

const FUNCTHIS_TELEMETRY_EVENT_TYPE_FIELD = 'ft_event_type';

export const withTelemetryIndexFields = (
  event: Record<string, unknown>
): Record<string, unknown> => ({
  ...event,
  [FUNCTHIS_TELEMETRY_EVENT_TYPE_FIELD]: event.type,
  ft_execution_id: event.executionId,
  ft_function_slug: event.functionSlug,
  ft_handle: event.handle,
  ft_org_id: event.organizationId,
  ft_package_slug: event.packageSlug,
  ft_version_id: event.versionId,
});

const quote = (value: string): string => JSON.stringify(value);

/** Search ingested JSON without requiring columns in the dataset schema yet. */
export const aplSearch = (term: string): string => `search ${quote(term)}`;

export const aplJsonFieldSearch = (field: string, value: string): string =>
  aplSearch(`${JSON.stringify(field)}:${JSON.stringify(value)}`);

export const telemetryEventType = (
  record: Record<string, unknown>
): string | null => {
  const value = record.type ?? record[FUNCTHIS_TELEMETRY_EVENT_TYPE_FIELD];
  return typeof value === 'string' ? value : null;
};

export const isTelemetryLogRecord = (
  record: Record<string, unknown>
): boolean => {
  const eventType = telemetryEventType(record);
  if (eventType === 'log') {
    return true;
  }
  if (eventType === 'execution') {
    return false;
  }
  return typeof record.message === 'string';
};

export const isTelemetryExecutionRecord = (
  record: Record<string, unknown>
): boolean => {
  const eventType = telemetryEventType(record);
  if (eventType === 'execution') {
    return true;
  }
  return 'input' in record || 'output' in record;
};

export const filterTelemetryRecordsByPackages = (
  records: readonly Record<string, unknown>[],
  packages: readonly { handle: string; packageSlug: string }[],
  organizationId: string
): Record<string, unknown>[] => {
  if (packages.length === 0) {
    return [];
  }
  return records.filter((record) => {
    const recordOrg = String(record.organizationId ?? record.ft_org_id ?? '');
    if (recordOrg && recordOrg !== organizationId) {
      return false;
    }
    const handle = String(record.handle ?? record.ft_handle ?? '').trim();
    const packageSlug = String(
      record.packageSlug ?? record.ft_package_slug ?? ''
    ).trim();
    if (!handle && !packageSlug) {
      return true;
    }
    if (handle && packageSlug) {
      return packages.some(
        (pkg) => pkg.handle === handle && pkg.packageSlug === packageSlug
      );
    }
    return packages.some(
      (pkg) =>
        (handle.length > 0 && pkg.handle === handle) ||
        (packageSlug.length > 0 && pkg.packageSlug === packageSlug)
    );
  });
};

export const filterDashboardTelemetryRecords = (
  records: readonly Record<string, unknown>[],
  options: {
    executionId?: string;
    organizationId: string;
    packages: readonly { handle: string; packageSlug: string }[];
  }
): Record<string, unknown>[] => {
  const scoped = records.filter((record) => {
    const recordOrg = String(record.organizationId ?? record.ft_org_id ?? '');
    if (recordOrg && recordOrg !== options.organizationId) {
      return false;
    }
    if (options.executionId) {
      const executionId = String(
        record.executionId ?? record.ft_execution_id ?? ''
      );
      if (executionId !== options.executionId) {
        return false;
      }
      return isTelemetryExecutionRecord(record);
    }
    return isTelemetryLogRecord(record);
  });
  return filterTelemetryRecordsByPackages(
    scoped,
    options.packages,
    options.organizationId
  );
};
