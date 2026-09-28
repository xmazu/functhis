import type { ReactElement } from 'react';

import { cn } from '#/lib/utils';

const LEVEL_COLORS: Record<string, string> = {
  debug: 'bg-muted-foreground',
  error: 'bg-destructive',
  info: 'bg-info',
  log: 'bg-muted-foreground',
  success: 'bg-success',
  warn: 'bg-warning',
  warning: 'bg-warning',
};

export const DataTableCellLevelIndicator = ({
  label = '',
  showLabel = false,
  value,
}: {
  label?: string;
  showLabel?: boolean;
  value: string;
}): ReactElement => {
  const display = label || value;
  const dot = (
    <span
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-sm',
        LEVEL_COLORS[value.toLowerCase()] ?? 'bg-muted'
      )}
    />
  );

  if (!showLabel) {
    return (
      <span className="flex items-center">
        <span aria-label={display} className="inline-flex">
          {dot}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {dot}
      <span className="truncate font-medium">{display}</span>
    </span>
  );
};
