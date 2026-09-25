import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { Button } from '#/components/ui/button';
import { cn } from '#/lib/utils';

const COPY_RESET_MS = 1500;

export const CopyButton = ({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, COPY_RESET_MS);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      aria-label={copied ? 'Copied' : label}
      className="active:scale-[0.96] motion-reduce:active:scale-100"
      onClick={() => {
        void handleCopy();
      }}
      size="icon-xs"
      variant="ghost"
    >
      <span className="relative size-3.5">
        <IconCopy
          aria-hidden="true"
          className={cn(
            'absolute inset-0 size-3.5 transition-[opacity,transform,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
            copied
              ? 'scale-[0.25] opacity-0 blur-[4px]'
              : 'blur-0 scale-100 opacity-100'
          )}
        />
        <IconCheck
          aria-hidden="true"
          className={cn(
            'absolute inset-0 size-3.5 transition-[opacity,transform,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
            copied
              ? 'blur-0 scale-100 opacity-100'
              : 'scale-[0.25] opacity-0 blur-[4px]'
          )}
        />
      </span>
    </Button>
  );
};
