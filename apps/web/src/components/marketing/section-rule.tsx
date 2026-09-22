import { BrandMark } from '#/components/brand-mark';

interface SectionRuleProps {
  className?: string;
}

export const SectionRule = ({ className }: SectionRuleProps) => (
  <div className={className ?? 'mt-[102px] flex items-center gap-3'}>
    <div className="h-px flex-1 bg-zinc-800" />
    <BrandMark className="h-4.5 w-4.5" />
    <div className="h-px flex-1 bg-zinc-800" />
  </div>
);
