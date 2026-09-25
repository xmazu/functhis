import { cn } from '#/lib/utils';

interface BrandMarkProps {
  className?: string;
}

export const BrandMark = ({ className }: BrandMarkProps) => (
  <img
    alt=""
    aria-hidden="true"
    className={cn('h-8 w-8 shrink-0 object-contain', className)}
    height={32}
    src="/functhis-logo.png"
    width={32}
  />
);
