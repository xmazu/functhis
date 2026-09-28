import type { ComponentProps, ReactElement } from 'react';

import { cn } from '#/lib/utils';

export const Kbd = ({
  className,
  ...props
}: ComponentProps<'kbd'>): ReactElement => (
  <kbd
    className={cn(
      'bg-muted text-muted-foreground pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-sm border px-1 font-sans text-[10px] font-medium select-none',
      className
    )}
    data-slot="kbd"
    {...props}
  />
);
