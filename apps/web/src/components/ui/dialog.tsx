'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import type React from 'react';

import { Button } from '#/components/ui/button';
import { cn } from '#/lib/utils';

export const Dialog: typeof DialogPrimitive.Root = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogBackdrop = ({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props): React.ReactElement => (
  <DialogPrimitive.Backdrop
    className={cn(
      'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0',
      className
    )}
    {...props}
  />
);

export const DialogPopup = ({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}): React.ReactElement => (
  <DialogPrimitive.Portal>
    <DialogBackdrop />
    <DialogPrimitive.Popup
      className={cn(
        'dark border-border bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-4 outline-hidden',
        className
      )}
      data-surface="dashboard-overlay"
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close
          aria-label="Close dialog"
          render={
            <Button
              className="text-muted-foreground hover:text-foreground absolute top-2 right-2"
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <XIcon />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Popup>
  </DialogPrimitive.Portal>
);

export const DialogTitle = ({
  className,
  ...props
}: DialogPrimitive.Title.Props): React.ReactElement => (
  <DialogPrimitive.Title
    className={cn(
      'text-popover-foreground text-[length:var(--app-font-size-ui,12px)] font-medium',
      className
    )}
    {...props}
  />
);

export const DialogDescription = ({
  className,
  ...props
}: DialogPrimitive.Description.Props): React.ReactElement => (
  <DialogPrimitive.Description
    className={cn(
      'text-muted-foreground mt-1 text-[length:var(--app-font-size-ui,12px)]',
      className
    )}
    {...props}
  />
);
