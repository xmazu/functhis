'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import type { ReactElement } from 'react';

import { cn } from '#/lib/utils';

export const Popover: typeof PopoverPrimitive.Root = PopoverPrimitive.Root;

export const PopoverTrigger = ({
  className,
  ...props
}: PopoverPrimitive.Trigger.Props): ReactElement => (
  <PopoverPrimitive.Trigger
    className={className}
    data-slot="popover-trigger"
    {...props}
  />
);

export const PopoverPopup = ({
  align = 'start',
  alignOffset = 0,
  children,
  className,
  side = 'bottom',
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  >): ReactElement => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      className="isolate z-50 outline-none"
      side={side}
      sideOffset={sideOffset}
    >
      <PopoverPrimitive.Popup
        className={cn(
          'dark border-border bg-popover/70 text-popover-foreground data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 relative z-50 origin-(--transform-origin) overflow-hidden rounded-md border text-[length:var(--app-font-size-ui,12px)] backdrop-blur-[4px] backdrop-saturate-[130%] outline-none',
          className
        )}
        data-slot="popover-popup"
        data-surface="dashboard-overlay"
        {...props}
      >
        {children}
      </PopoverPrimitive.Popup>
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
);
