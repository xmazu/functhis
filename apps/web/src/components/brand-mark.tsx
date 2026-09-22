import { cn } from '@functhis/ui/lib/utils';

interface BrandMarkProps {
  className?: string;
}

export const BrandMark = ({ className }: BrandMarkProps) => (
  <svg
    aria-hidden="true"
    className={cn('h-8 w-8', className)}
    fill="none"
    viewBox="0 0 32 32"
  >
    <path
      d="M11 5c-4.2 2.8-7 6.8-7 11s2.8 8.2 7 11"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.4"
    />
    <path
      d="M21 5c4.2 2.8 7 6.8 7 11s-2.8 8.2-7 11"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.4"
    />
    <circle cx="16" cy="16" fill="currentColor" r="2.4" />
  </svg>
);
