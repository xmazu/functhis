interface SectionRuleProps {
  className?: string;
}

export const SectionRule = ({ className }: SectionRuleProps) => (
  <hr className={className ?? 'mt-[102px] border-0 border-t border-zinc-800'} />
);
