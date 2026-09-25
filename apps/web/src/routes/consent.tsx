import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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
import {
  CONSENT_CLOSE_DELAY_SECONDS,
  consentCloseCountdownCopy,
  consentRedirectUrl,
  decideConsentRedirect,
  deliverLoopbackOAuthRedirect,
  suppressClientRedirect,
} from '#/lib/auth/consent-redirect';
import {
  consentOAuthQueryFromLocation,
  consentRequest,
} from '#/lib/auth/consent-request';
import {
  callbackURLFromLocation,
  redirectToLogin,
} from '#/lib/auth/login-redirect';

const ConsentCompleteCard = ({ accepted }: { accepted: boolean }) => {
  const [secondsLeft, setSecondsLeft] = useState(CONSENT_CLOSE_DELAY_SECONDS);

  useEffect(() => {
    if (secondsLeft > 0) {
      const timeoutId = window.setTimeout(() => {
        setSecondsLeft(secondsLeft - 1);
      }, 1000);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }
    window.close();
  }, [secondsLeft]);

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="p-4">
        <CardTitle className="text-[length:var(--app-font-size-ui,12px)] font-medium">
          You can close this page
        </CardTitle>
        <CardDescription className="text-[length:var(--app-font-size-ui,12px)]">
          {accepted ? 'Authorization is complete.' : 'Access was denied.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        <p
          aria-live="polite"
          className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]"
        >
          {consentCloseCountdownCopy(secondsLeft)}
        </p>
        <Button
          className="w-full"
          onClick={() => {
            window.close();
          }}
        >
          Close
        </Button>
      </CardContent>
    </Card>
  );
};

const ConsentPage = () => {
  const { client_id, scope } = Route.useSearch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<'allowed' | 'denied' | null>(null);

  const finishConsent = async (accepted: boolean) => {
    setIsSubmitting(true);
    const failureMessage = accepted
      ? 'Could not complete consent'
      : 'Could not deny consent';
    try {
      const oauthQuery = consentOAuthQueryFromLocation();
      const { data, error } = await authClient.oauth2.consent({
        ...consentRequest(
          accepted
            ? { accept: true, oauthQuery, scope }
            : { accept: false, oauthQuery }
        ),
        fetchOptions: {
          onSuccess: (context) => {
            suppressClientRedirect(context.data);
          },
        },
      });
      if (error) {
        toast.error(error.message ?? failureMessage);
        setIsSubmitting(false);
        return;
      }
      const decision = decideConsentRedirect(consentRedirectUrl(data));
      if (decision.kind === 'stay' && decision.deliverUrl) {
        deliverLoopbackOAuthRedirect(decision.deliverUrl);
      }
      if (decision.kind === 'leave') {
        window.location.assign(decision.url);
        return;
      }
      setOutcome(accepted ? 'allowed' : 'denied');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failureMessage);
    }
    setIsSubmitting(false);
  };

  if (outcome) {
    return (
      <AuthCanvas>
        <ConsentCompleteCard accepted={outcome === 'allowed'} />
      </AuthCanvas>
    );
  }

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
              onClick={() => {
                void finishConsent(true);
              }}
            >
              Allow
            </Button>
            <Button
              className="flex-1"
              disabled={isSubmitting}
              variant="destructive-outline"
              onClick={() => {
                void finishConsent(false);
              }}
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
    const callbackURL = callbackURLFromLocation(location);
    const session = await resolveSession();
    if (!session) {
      throw redirectToLogin(callbackURL);
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: typeof search.client_id === 'string' ? search.client_id : '',
    scope: typeof search.scope === 'string' ? search.scope : '',
  }),
});
