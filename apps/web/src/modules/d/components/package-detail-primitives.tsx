import type { ReactElement, ReactNode } from 'react';

const ui = 'text-[length:var(--app-font-size-ui,12px)]';

export const packageDetailUiClass = ui;

export const SectionHeading = ({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}): ReactElement => (
  <h2 className={`${ui} text-muted-foreground`} id={id}>
    {children}
  </h2>
);

export const MetaItem = ({
  label,
  children,
}: {
  children: ReactNode;
  label: string;
}): ReactElement => (
  <div className="space-y-1">
    <dt className={`${ui} text-muted-foreground`}>{label}</dt>
    <dd className={`${ui} font-mono`}>{children}</dd>
  </div>
);
