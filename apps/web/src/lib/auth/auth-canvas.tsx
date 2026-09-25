import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import '#/routes/d/-load-surface';
import { authClient } from '#/lib/auth/auth-client';

export const AuthCanvas = ({ children }: { children: ReactNode }) => {
  const { data: session } = authClient.useSession();

  return (
    <div
      className="dark bg-background relative flex min-h-svh flex-col"
      data-surface="auth"
    >
      <div className="absolute inset-x-0 top-0 flex items-center px-4 py-3">
        {session ? (
          <Link
            className="text-foreground/80 hover:text-foreground text-[length:var(--app-font-size-ui,12px)]"
            to="/d"
          >
            Functhis
          </Link>
        ) : (
          <p className="text-foreground/80 text-[length:var(--app-font-size-ui,12px)]">
            Functhis
          </p>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        {children}
      </div>
    </div>
  );
};
