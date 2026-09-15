import { Button } from '@functhis/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@functhis/ui/components/card';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

import { getUser } from '@/functions/get-user';
import { authClient } from '@/lib/auth-client';

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
    <main className="mx-auto flex max-w-lg flex-1 items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Authorize application</CardTitle>
          <CardDescription>
            Review what this client is requesting before you continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4 text-sm">
            <p>
              <span className="font-medium">Client:</span>{' '}
              {client_id || 'Unknown client'}
            </p>
            <p className="mt-2">
              <span className="font-medium">Scopes:</span>{' '}
              {scope || 'Default scopes'}
            </p>
          </div>
          <p className="text-muted-foreground text-sm">
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
              variant="outline"
              onClick={handleDeny}
            >
              Deny
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export const Route = createFileRoute('/consent')({
  component: ConsentPage,
  beforeLoad: async () => {
    const session = await getUser();
    if (!session) {
      throw redirect({ to: '/login' });
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: typeof search.client_id === 'string' ? search.client_id : '',
    oauth_query:
      typeof search.oauth_query === 'string' ? search.oauth_query : undefined,
    scope: typeof search.scope === 'string' ? search.scope : '',
  }),
});
