import { createFileRoute, redirect, useSearch } from '@tanstack/react-router';

import { Button } from '#/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card';
import { resolveSession } from '#/functions/resolve-session';
import { AuthCanvas } from '#/lib/auth/auth-canvas';
import { authClient } from '#/lib/auth/auth-client';
import { safeCallbackURL } from '#/lib/auth/safe-callback-url';

const LoginPage = () => {
  const { callbackURL } = useSearch({ from: '/login' });

  return (
    <AuthCanvas>
      <Card className="w-full max-w-md">
        <CardHeader className="p-4">
          <CardTitle className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Sign in to Functhis
          </CardTitle>
          <CardDescription className="text-[length:var(--app-font-size-ui,12px)]">
            Use GitHub to access the owner console, approve MCP clients, and
            authorize the CLI.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Button
            className="w-full"
            onClick={() => {
              authClient.signIn.social({
                callbackURL,
                provider: 'github',
              });
            }}
          >
            Continue with GitHub
          </Button>
        </CardContent>
      </Card>
    </AuthCanvas>
  );
};

export const Route = createFileRoute('/login')({
  component: LoginPage,
  validateSearch: (
    search: Record<string, unknown>
  ): { callbackURL: string } => ({
    callbackURL: safeCallbackURL(search.callbackURL),
  }),
  beforeLoad: async ({ search }) => {
    const { callbackURL } = search;
    const session = await resolveSession();
    if (session) {
      throw redirect({ to: callbackURL });
    }
  },
});
