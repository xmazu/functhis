import type { ReactNode } from 'react';

import { cn } from '#/lib/utils';

export const settingsText = 'text-[length:var(--app-font-size-ui,12px)]';

export const SettingsPage = ({
  title,
  description,
  action,
  children,
  contentClassName,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  className?: string;
}) => (
  <main className="min-h-0 flex-1 overflow-auto">
    <div
      className={cn(
        'mx-auto flex w-full max-w-[36rem] flex-col gap-5 px-4 pt-6 pb-10',
        contentClassName,
        className
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className={`${settingsText} font-medium`}>{title}</h1>
          <p className={`${settingsText} text-muted-foreground mt-1`}>
            {description}
          </p>
        </div>
        {action}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  </main>
);

export const SettingsSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-1.5">
    <h2 className={`${settingsText} text-foreground/55 px-2 py-1`}>{title}</h2>
    <div className="divide-border divide-y overflow-hidden rounded-xl border border-white/8 bg-white/[0.03]">
      {children}
    </div>
  </section>
);

export const SettingsRow = ({
  title,
  description,
  control,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
}) => (
  <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 flex-1">
      <h3 className={`${settingsText} font-medium`}>{title}</h3>
      {description ? (
        <p className={`${settingsText} text-muted-foreground mt-0.5`}>
          {description}
        </p>
      ) : null}
    </div>
    {control ? (
      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
        {control}
      </div>
    ) : null}
    {children}
  </div>
);

export const SettingsEmpty = ({ children }: { children: ReactNode }) => (
  <div className={`${settingsText} text-muted-foreground px-3 py-6`}>
    {children}
  </div>
);
