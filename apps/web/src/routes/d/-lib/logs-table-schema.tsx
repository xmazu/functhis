import { DataTableCellLevelIndicator } from '#/components/data-table/data-table-cell-level-indicator';
import { DataTableCellTimestamp } from '#/components/data-table/data-table-cell-timestamp';
import { DataTableColumnHeader } from '#/components/data-table/data-table-column-header';
import { TextWithTooltip } from '#/components/data-table/text-with-tooltip';
import type { LogsColumn } from '#/routes/d/-lib/logs-table-row';

export type { LogsTableRow } from '#/routes/d/-lib/logs-table-row';

export const LOGS_TABLE_COLUMNS: LogsColumn[] = [
  {
    accessorKey: 'timestamp',
    cell: ({ getValue }) => (
      <DataTableCellTimestamp value={String(getValue())} />
    ),
    enableSorting: true,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Timestamp" />
    ),
    id: 'timestamp',
    size: 168,
  },
  {
    accessorKey: 'level',
    cell: ({ getValue }) => (
      <DataTableCellLevelIndicator
        showLabel
        value={String(getValue() ?? 'log')}
      />
    ),
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Level" />
    ),
    id: 'level',
    size: 88,
  },
  {
    accessorFn: (row) => `@${row.handle}/${row.packageSlug}`,
    cell: ({ getValue }) => (
      <TextWithTooltip className="font-mono" text={String(getValue())} />
    ),
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Package" />
    ),
    id: 'package',
    size: 220,
  },
  {
    accessorKey: 'functionSlug',
    cell: ({ getValue }) => (
      <TextWithTooltip className="font-mono" text={String(getValue())} />
    ),
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Function" />
    ),
    id: 'functionSlug',
    size: 180,
  },
  {
    accessorKey: 'message',
    cell: ({ getValue }) => <TextWithTooltip text={String(getValue())} />,
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message" />
    ),
    id: 'message',
  },
];
