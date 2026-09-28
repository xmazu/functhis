import type { ColumnDef } from '@tanstack/react-table';

import type { DataTableFeatures } from '#/components/data-table/features';

export interface LogsTableRow {
  executionId: string;
  functionSlug: string;
  handle: string;
  level: string;
  message: string;
  packageSlug: string;
  timestamp: string;
  versionId: string;
}

export type LogsColumn = ColumnDef<DataTableFeatures, LogsTableRow>;
