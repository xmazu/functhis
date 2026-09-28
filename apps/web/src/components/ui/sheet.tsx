'use client';

import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { IconX } from '@tabler/icons-react';
import type React from 'react';

import { Button } from '#/components/ui/button';
import { ScrollArea } from '#/components/ui/scroll-area';
import { cn } from '#/lib/utils';

const ui =
  'text-[length:var(--app-font-size-ui,12px)] leading-[var(--app-density-line-height,1.25)]';

export const Sheet: typeof SheetPrimitive.Root = SheetPrimitive.Root;

export const SheetPortal: typeof SheetPrimitive.Portal = SheetPrimitive.Portal;

export const SheetTrigger = (
  props: SheetPrimitive.Trigger.Props
): React.ReactElement => (
  <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
);

export const SheetClose = (
  props: SheetPrimitive.Close.Props
): React.ReactElement => (
  <SheetPrimitive.Close data-slot="sheet-close" {...props} />
);

export const SheetBackdrop = ({
  className,
  ...props
}: SheetPrimitive.Backdrop.Props): React.ReactElement => (
  <SheetPrimitive.Backdrop
    className={cn(
      'fixed inset-0 z-50 bg-black/32 transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0',
      className
    )}
    data-slot="sheet-backdrop"
    {...props}
  />
);

export const SheetViewport = ({
  className,
  side,
  variant = 'default',
  ...props
}: SheetPrimitive.Viewport.Props & {
  side?: 'right' | 'left' | 'top' | 'bottom';
  variant?: 'default' | 'inset';
}): React.ReactElement => (
  <SheetPrimitive.Viewport
    className={cn(
      'fixed inset-0 z-50 grid',
      side === 'bottom' && 'grid grid-rows-[1fr_auto] pt-12',
      side === 'top' && 'grid grid-rows-[auto_1fr] pb-12',
      side === 'left' && 'flex justify-start',
      side === 'right' && 'flex justify-end',
      variant === 'inset' && 'sm:p-4',
      className
    )}
    data-slot="sheet-viewport"
    {...props}
  />
);

export const SheetPopup = ({
  className,
  children,
  showCloseButton = true,
  side = 'right',
  variant = 'default',
  closeProps,
  portalProps,
  ...props
}: SheetPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  side?: 'right' | 'left' | 'top' | 'bottom';
  variant?: 'default' | 'inset';
  closeProps?: SheetPrimitive.Close.Props;
  portalProps?: SheetPrimitive.Portal.Props;
}): React.ReactElement => (
  <SheetPortal {...portalProps}>
    <SheetBackdrop />
    <SheetViewport side={side} variant={variant}>
      <SheetPrimitive.Popup
        className={cn(
          'dark bg-background text-foreground relative flex max-h-full min-h-0 w-full min-w-0 flex-col shadow-none outline-hidden transition-[opacity,translate] duration-200 ease-in-out will-change-transform data-ending-style:opacity-0 data-starting-style:opacity-0',
          side === 'bottom' &&
            'row-start-2 shadow-[inset_0_1px_0_0_var(--seam-line)] data-ending-style:translate-y-8 data-starting-style:translate-y-8',
          side === 'top' &&
            'shadow-[inset_0_-1px_0_0_var(--seam-line)] data-ending-style:-translate-y-8 data-starting-style:-translate-y-8',
          side === 'left' &&
            'w-[calc(100%-(--spacing(12)))] max-w-md shadow-[inset_-1px_0_0_0_var(--seam-line)] data-ending-style:-translate-x-8 data-starting-style:-translate-x-8',
          side === 'right' &&
            'col-start-2 w-[calc(100%-(--spacing(12)))] max-w-md shadow-[inset_1px_0_0_0_var(--seam-line)] data-ending-style:translate-x-8 data-starting-style:translate-x-8',
          variant === 'inset' && 'sm:rounded-md',
          className
        )}
        data-slot="sheet-popup"
        data-surface="dashboard-overlay"
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            aria-label="Close"
            className="absolute end-1.5 top-1.5"
            render={
              <Button
                className="text-muted-foreground hover:text-foreground"
                size="icon-xs"
                variant="ghost"
              />
            }
            {...closeProps}
          >
            <IconX />
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Popup>
    </SheetViewport>
  </SheetPortal>
);

export const SheetHeader = ({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'>): React.ReactElement => {
  const defaultProps = {
    className: cn(
      'flex min-h-8 shrink-0 flex-col justify-center gap-0.5 px-3 py-2 pr-10 shadow-[inset_0_-1px_0_0_var(--seam-line)]',
      className
    ),
    'data-slot': 'sheet-header',
  };

  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(defaultProps, props),
    render,
  });
};

export const SheetFooter = ({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'div'> & {
  variant?: 'default' | 'bare';
}): React.ReactElement => {
  const defaultProps = {
    className: cn(
      'flex shrink-0 flex-col-reverse gap-2 px-3 sm:flex-row sm:justify-end',
      variant === 'default' &&
        'bg-muted py-2 shadow-[inset_0_1px_0_0_var(--seam-line)]',
      variant === 'bare' && 'py-2 shadow-[inset_0_1px_0_0_var(--seam-line)]',
      className
    ),
    'data-slot': 'sheet-footer',
  };

  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(defaultProps, props),
    render,
  });
};

export const SheetTitle = ({
  className,
  ...props
}: SheetPrimitive.Title.Props): React.ReactElement => (
  <SheetPrimitive.Title
    className={cn(ui, 'text-foreground font-medium', className)}
    data-slot="sheet-title"
    {...props}
  />
);

export const SheetDescription = ({
  className,
  ...props
}: SheetPrimitive.Description.Props): React.ReactElement => (
  <SheetPrimitive.Description
    className={cn(ui, 'text-muted-foreground', className)}
    data-slot="sheet-description"
    {...props}
  />
);

export const SheetPanel = ({
  className,
  scrollFade = true,
  render,
  ...props
}: useRender.ComponentProps<'div'> & {
  scrollFade?: boolean;
}): React.ReactElement => {
  const defaultProps = {
    className: cn(ui, 'p-3', className),
    'data-slot': 'sheet-panel',
  };

  return (
    <ScrollArea
      overscrollContain
      scrollFade={scrollFade}
      viewportClassName="rounded-none shadow-none"
    >
      {useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
      })}
    </ScrollArea>
  );
};

export { SheetBackdrop as SheetOverlay, SheetPopup as SheetContent };
