import { Button } from '@functhis/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@functhis/ui/components/card';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { getUser } from '@/functions/get-user';
import { authClient } from '@/lib/auth-client';

const LoginPage = () => (
  <main className="mx-auto flex max-w-md flex-1 items-center p-6">
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sign in to Functhis</CardTitle>
        <CardDescription>
          Use GitHub to access the owner console, approve MCP clients, and
          authorize the CLI.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full"
          onClick={() => {
            authClient.signIn.social({
              callbackURL: '/',
              provider: 'github',
            });
          }}
        >
          Continue with GitHub
        </Button>
      </CardContent>
    </Card>
  </main>
);

export const Route = createFileRoute('/login')({
  component: LoginPage,
  beforeLoad: async () => {
    const session = await getUser();
    if (session) {
      throw redirect({ to: '/' });
    }
  },
});
