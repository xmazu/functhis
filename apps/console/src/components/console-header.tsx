import { Button } from '@functhis/ui/components/button';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { authClient } from '@/lib/auth-client';

const ConsoleHeader = () => {
  const { data: session, isPending } = authClient.useSession();

  let authControls: ReactNode;
  if (isPending) {
    authControls = null;
  } else if (session) {
    authControls = (
      <>
        <span className="text-sm">{session.user.name}</span>
        <Button
          variant="outline"
          onClick={() => {
            authClient.signOut();
          }}
        >
          Sign out
        </Button>
      </>
    );
  } else {
    authControls = (
      <Link to="/login">
        <Button variant="outline">Sign in</Button>
      </Link>
    );
  }

  return (
    <header className="border-b px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Functhis Console</p>
          <p className="text-muted-foreground text-sm">
            Sign in, consent, and device approval
          </p>
        </div>
        <div className="flex items-center gap-2">{authControls}</div>
      </div>
    </header>
  );
};

export default ConsoleHeader;
