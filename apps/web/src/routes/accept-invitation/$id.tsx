import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { resolveSession } from '#/functions/resolve-session';
import { AuthCanvas } from '#/lib/auth/auth-canvas';
import { authClient } from '#/lib/auth/auth-client';
import { redirectToLogin } from '#/lib/auth/login-redirect';
import { Button } from '#/routes/d/-components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/routes/d/-components/ui/card';

const AcceptInvitationPage = () => {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const acceptStarted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (acceptStarted.current) {
      return;
    }
    acceptStarted.current = true;

    const accept = async (): Promise<void> => {
      const { error: acceptError } =
        await authClient.organization.acceptInvitation({
          invitationId: id,
        });
      if (acceptError) {
        setError(acceptError.message ?? 'Could not accept invitation');
        return;
      }
      setDone(true);
      await navigate({ to: '/d/orgs' });
    };
    void accept();
  }, [id, navigate]);

  return (
    <AuthCanvas>
      <Card className="w-full max-w-md">
        <CardHeader className="p-4">
          <CardTitle className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Accept invitation
          </CardTitle>
          <CardDescription className="text-[length:var(--app-font-size-ui,12px)]">
            {done
              ? 'Redirecting to organizations…'
              : 'Joining the organization for this invite.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {error ? (
            <>
              <p className="text-destructive mb-3 text-[length:var(--app-font-size-ui,12px)]">
                {error}
              </p>
              <Button
                onClick={() => {
                  void navigate({ to: '/d/orgs' });
                }}
                size="sm"
                variant="outline"
              >
                Go to organizations
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </AuthCanvas>
  );
};

export const Route = createFileRoute('/accept-invitation/$id')({
  beforeLoad: async ({ params }) => {
    const invitationId = params.id;
    const session = await resolveSession();
    if (!session) {
      throw redirectToLogin(`/accept-invitation/${invitationId}`);
    }
  },
  component: AcceptInvitationPage,
});
