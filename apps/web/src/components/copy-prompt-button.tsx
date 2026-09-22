'use client';

import { cn } from '@functhis/ui/lib/utils';
import { useState } from 'react';

import { AGENT_PROMPT } from '#/lib/agent-prompt';

interface CopyPromptButtonProps {
  className?: string;
  copiedLabel: string;
  idleLabel: string;
  size: 'header' | 'hero';
}

const CopyIcon = ({ size }: { size: number }) => (
  <svg
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 16 16"
    width={size}
  >
    <rect height="9" rx="1" width="9" x="5.5" y="5.5" />
    <path d="M10.5 5.5V2.5a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3" />
  </svg>
);

const CheckIcon = ({ size }: { size: number }) => (
  <svg
    className="text-green-500"
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 16 16"
    width={size}
  >
    <path d="M3 8.5 6.5 12 13 4" />
  </svg>
);

export const CopyPromptButton = ({
  className,
  copiedLabel,
  idleLabel,
  size,
}: CopyPromptButtonProps) => {
  const [copied, setCopied] = useState(false);
  const iconSize = size === 'header' ? 12 : 14;
  const isHeader = size === 'header';

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AGENT_PROMPT);
    } catch {
      const field = document.createElement('textarea');
      field.value = AGENT_PROMPT;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.left = '-9999px';
      document.body.append(field);
      field.select();
      const copiedFallback = document.execCommand('copy');
      field.remove();
      if (!copiedFallback) {
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1800);
  };

  return (
    <button
      className={cn(
        'relative inline-flex max-w-full cursor-pointer items-center rounded-full border border-transparent bg-zinc-50 font-medium text-zinc-950 transition-colors hover:bg-zinc-200 active:scale-[0.96]',
        isHeader ? 'px-3 py-1 text-xs' : 'px-5 py-3 text-base',
        className
      )}
      onClick={() => {
        void copyPrompt();
      }}
      title="Copy instructions"
      type="button"
    >
      <span
        aria-hidden={copied}
        className={cn(
          'flex-1 text-left transition-opacity duration-300',
          isHeader && 'truncate whitespace-nowrap',
          copied ? 'opacity-0' : 'opacity-100'
        )}
      >
        {idleLabel}
      </span>
      <span
        className={cn(
          'shrink-0 items-center justify-center',
          isHeader ? 'ml-2.5 flex w-3' : 'ml-6 flex w-3.5'
        )}
      >
        <span
          className={cn(
            'absolute transition-opacity duration-300',
            copied ? 'opacity-100' : 'opacity-0'
          )}
        >
          <CheckIcon size={iconSize} />
        </span>
        <span
          className={cn(
            'transition-opacity duration-300',
            copied ? 'opacity-0' : 'opacity-100'
          )}
        >
          <CopyIcon size={iconSize} />
        </span>
      </span>
      <span
        aria-hidden={!copied}
        className={cn(
          'absolute inset-y-0 flex items-center transition-opacity duration-300',
          isHeader ? 'left-3' : 'left-5',
          copied ? 'opacity-100' : 'opacity-0'
        )}
      >
        {copiedLabel}
      </span>
    </button>
  );
};
