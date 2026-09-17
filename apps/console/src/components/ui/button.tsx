'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  "focus-visible:ring-ring/60 focus-visible:ring-offset-background relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border text-[length:var(--app-font-size-ui,12px)] font-medium whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-64 data-loading:text-transparent data-loading:select-none pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-8 px-[calc(--spacing(3)-1px)]',
        icon: 'size-9 sm:size-8',
        'icon-lg': 'size-10 sm:size-9',
        'icon-sm': 'size-8 sm:size-7',
        'icon-xl':
          "size-11 sm:size-10 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        'icon-xs':
          "size-7 rounded-md sm:size-6 not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-4 sm:not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-10 px-[calc(--spacing(3.5)-1px)] sm:h-9',
        sm: 'h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:h-7',
        xl: "h-11 px-[calc(--spacing(4)-1px)] sm:h-10 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        xs: "h-7 gap-1 rounded-md px-[calc(--spacing(2)-1px)] sm:h-6 [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
      },
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 data-pressed:bg-primary/90 *:data-[slot=button-loading-indicator]:text-primary-foreground border-transparent',
        destructive:
          'bg-destructive hover:bg-destructive/90 data-pressed:bg-destructive/90 border-transparent text-white *:data-[slot=button-loading-indicator]:text-white',
        'destructive-outline':
          'border-border text-destructive-foreground hover:border-destructive/32 hover:bg-destructive/4 data-pressed:border-destructive/32 data-pressed:bg-destructive/4 *:data-[slot=button-loading-indicator]:text-foreground bg-transparent',
        ghost:
          'text-foreground hover:bg-accent data-pressed:bg-accent *:data-[slot=button-loading-indicator]:text-foreground border-transparent',
        link: 'text-foreground *:data-[slot=button-loading-indicator]:text-foreground border-transparent underline-offset-4 hover:underline data-pressed:underline',
        outline:
          'border-border text-foreground hover:bg-accent/50 data-pressed:bg-accent/50 *:data-[slot=button-loading-indicator]:text-foreground bg-transparent',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/90 data-pressed:bg-secondary/90 *:data-[slot=button-loading-indicator]:text-secondary-foreground border-transparent',
      },
    },
  }
);

export interface ButtonProps extends useRender.ComponentProps<'button'> {
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  loading?: boolean;
}

export const Button = ({
  className,
  variant,
  size,
  render,
  children,
  loading = false,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement => {
  const isDisabled = Boolean(loading || disabledProp);
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] =
    render ? undefined : 'button';

  const defaultProps = {
    'aria-disabled': loading || undefined,
    children: (
      <>
        {children}
        {loading && (
          <Spinner
            className="pointer-events-none absolute"
            data-slot="button-loading-indicator"
          />
        )}
      </>
    ),
    className: cn(buttonVariants({ className, size, variant })),
    'data-loading': loading ? '' : undefined,
    'data-slot': 'button',
    disabled: isDisabled,
    type: typeValue,
  };

  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(defaultProps, props),
    render,
  });
};
