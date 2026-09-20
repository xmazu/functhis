import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

import { AuthCanvas } from '@/components/auth-canvas';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { resolveSession } from '@/functions/resolve-session';
import { authClient } from '@/lib/auth-client';
import { redirectToLogin } from '@/lib/login-redirect';

const buildOauthQuery = ({
  client_id,
  oauth_query,
  scope,
}: {
  client_id: string;
  oauth_query?: string;
  scope: string;
}) => {
  if (oauth_query) {
    return oauth_query;
  }
  const params = new URLSearchParams();
  if (client_id) {
    params.set('client_id', client_id);
  }
  if (scope) {
    params.set('scope', scope);
  }
  const query = params.toString();
  return query.length > 0 ? query : undefined;
};

const ConsentPage = () => {
  const navigate = useNavigate();
  const { client_id, oauth_query, scope } = Route.useSearch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resolvedOauthQuery = buildOauthQuery({
    client_id,
    oauth_query,
    scope,
  });

  const handleAllow = async () => {
    setIsSubmitting(true);
    try {
      await authClient.oauth2.consent({
        accept: true,
        oauth_query: resolvedOauthQuery,
        scope,
      });
      navigate({ to: '/' });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not complete consent'
      );
    }
    setIsSubmitting(false);
  };

  const handleDeny = async () => {
    setIsSubmitting(true);
    try {
      await authClient.oauth2.consent({
        accept: false,
        oauth_query: resolvedOauthQuery,
      });
      navigate({ to: '/' });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not deny consent'
      );
    }
    setIsSubmitting(false);
  };

  return (
    <AuthCanvas>
      <Card className="w-full max-w-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Authorize application
          </CardTitle>
          <CardDescription className="text-[length:var(--app-font-size-ui,12px)]">
            Review what this client is requesting before you continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="rounded-md border p-3 text-[length:var(--app-font-size-ui,12px)]">
            <p>
              <span className="font-medium">Client:</span>{' '}
              {client_id || 'Unknown client'}
            </p>
            <p className="mt-2">
              <span className="font-medium">Scopes:</span>{' '}
              {scope || 'Default scopes'}
            </p>
          </div>
          <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
            Only approve access for applications you trust. Functhis will issue
            tokens bound to the requested resource audience.
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={isSubmitting}
              onClick={handleAllow}
            >
              Allow
            </Button>
            <Button
              className="flex-1"
              disabled={isSubmitting}
              variant="destructive-outline"
              onClick={handleDeny}
            >
              Deny
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthCanvas>
  );
};

export const Route = createFileRoute('/consent')({
  component: ConsentPage,
  beforeLoad: async ({ location }) => {
    const session = await resolveSession();
    if (!session) {
      throw redirectToLogin(`${location.pathname}${location.search}`);
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: typeof search.client_id === 'string' ? search.client_id : '',
    oauth_query:
      typeof search.oauth_query === 'string' ? search.oauth_query : undefined,
    scope: typeof search.scope === 'string' ? search.scope : '',
  }),
});
