import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { ReactElement } from 'react';

import { Button } from '#/components/ui/button';
import { cn } from '#/lib/utils';

interface SortableColumnHeader {
  getCanSort: () => boolean;
  getIsSorted: () => false | 'asc' | 'desc';
  toggleSorting: () => void;
}

export const DataTableColumnHeader = ({
  className,
  column,
  title,
}: {
  className?: string;
  column: SortableColumnHeader;
  title: string;
}): ReactElement => {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>;
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      className={cn(
        'h-[var(--app-density-row-height,1.75rem)] w-full justify-between gap-2 px-0 py-0 font-medium hover:bg-transparent has-[>svg]:px-0',
        className
      )}
      onClick={() => {
        column.toggleSorting();
      }}
      size="sm"
      variant="ghost"
    >
      <span>{title}</span>
      <span className="flex flex-col">
        <IconChevronUp
          className={cn(
            '-mb-0.5 size-3',
            sorted === 'asc' ? 'text-foreground' : 'text-muted-foreground'
          )}
        />
        <IconChevronDown
          className={cn(
            '-mt-0.5 size-3',
            sorted === 'desc' ? 'text-foreground' : 'text-muted-foreground'
          )}
        />
      </span>
    </Button>
  );
};
