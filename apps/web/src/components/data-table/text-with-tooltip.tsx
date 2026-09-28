import type { CSSProperties, ReactElement } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip';
import { cn } from '#/lib/utils';

export const TextWithTooltip = ({
  className,
  style,
  text,
}: {
  className?: string;
  style?: CSSProperties;
  text: number | string;
}): ReactElement => (
  <Tooltip>
    <TooltipTrigger
      className={cn('block w-full truncate text-left font-normal', className)}
      render={<span />}
      style={style}
    >
      {text}
    </TooltipTrigger>
    <TooltipContent className="max-w-sm font-normal break-words whitespace-pre-wrap">
      {text}
    </TooltipContent>
  </Tooltip>
);
