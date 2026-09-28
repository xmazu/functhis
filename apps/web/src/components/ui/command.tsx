'use client';

import { Command as CommandPrimitive } from 'cmdk';
import type { ComponentProps, ReactElement } from 'react';

import { cn } from '#/lib/utils';

export const Command = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive>): ReactElement => (
  <CommandPrimitive
    className={cn(
      'flex w-full flex-col overflow-visible bg-transparent',
      className
    )}
    data-slot="command"
    {...props}
  />
);

export const CommandInput = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>): ReactElement => (
  <CommandPrimitive.Input
    className={cn(
      'placeholder:text-muted-foreground flex h-full w-full bg-transparent text-[length:var(--app-font-size-ui,12px)] outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    data-slot="command-input"
    {...props}
  />
);

export const CommandList = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.List>): ReactElement => (
  <CommandPrimitive.List
    className={cn('max-h-[310px] overflow-x-hidden overflow-y-auto', className)}
    data-slot="command-list"
    {...props}
  />
);

export const CommandEmpty = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>): ReactElement => (
  <CommandPrimitive.Empty
    className={cn(
      'text-muted-foreground py-6 text-center text-[length:var(--app-font-size-ui,12px)]',
      className
    )}
    data-slot="command-empty"
    {...props}
  />
);

export const CommandGroup = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>): ReactElement => (
  <CommandPrimitive.Group
    className={cn(
      'text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
      className
    )}
    data-slot="command-group"
    {...props}
  />
);

export const CommandSeparator = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>): ReactElement => (
  <CommandPrimitive.Separator
    className={cn('bg-border -mx-1 h-px', className)}
    data-slot="command-separator"
    {...props}
  />
);

export const CommandItem = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>): ReactElement => (
  <CommandPrimitive.Item
    className={cn(
      "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex min-h-[var(--app-density-row-height,1.75rem)] cursor-default items-center gap-2 rounded-md px-2 text-[length:var(--app-font-size-ui,12px)] outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
      className
    )}
    data-slot="command-item"
    {...props}
  />
);
