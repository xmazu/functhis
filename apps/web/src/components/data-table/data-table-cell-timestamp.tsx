import { format, formatDistanceToNowStrict } from 'date-fns';
import type { ReactElement } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip';

export const DataTableCellTimestamp = ({
  value,
}: {
  value: Date | number | string;
}): ReactElement => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger className="font-mono tabular-nums" render={<span />}>
        {formatDistanceToNowStrict(parsed, { addSuffix: true })}
      </TooltipTrigger>
      <TooltipContent className="font-mono">
        {format(parsed, 'LLL d, yyyy HH:mm:ss')}
      </TooltipContent>
    </Tooltip>
  );
};
