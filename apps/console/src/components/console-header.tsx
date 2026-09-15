import { Button } from '@functhis/ui/components/button';
import { Link } from '@tanstack/react-router';

import { authClient } from '@/lib/auth-client';

export default function ConsoleHeader() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <header className="border-b px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Functhis Console</p>
          <p className="text-muted-foreground text-sm">
            Sign in, consent, and device approval
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? null : session ? (
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
          ) : (
            <Link to="/login">
              <Button variant="outline">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
