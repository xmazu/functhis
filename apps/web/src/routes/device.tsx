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
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { resolveSession } from '#/functions/resolve-session';
import { AuthCanvas } from '#/lib/auth/auth-canvas';
import { lookupDeviceCode, postDeviceAction } from '#/lib/auth/device-api';
import type { DeviceVerification } from '#/lib/auth/device-api';
import {
  callbackURLFromLocation,
  redirectToLogin,
} from '#/lib/auth/login-redirect';

const normalizeUserCode = (code: string): string => code.trim();

const canDecideOnCode = (
  verification: DeviceVerification | null,
  userCode: string
): boolean => {
  if (!verification) {
    return false;
  }
  return (
    normalizeUserCode(verification.user_code) === normalizeUserCode(userCode)
  );
};

const DevicePage = () => {
  const { user_code: initialUserCode } = Route.useSearch();
  const [userCode, setUserCode] = useState(initialUserCode ?? '');
  const [verification, setVerification] = useState<DeviceVerification | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const decisionAllowed = canDecideOnCode(verification, userCode);

  useEffect(() => {
    if (!initialUserCode) {
      return;
    }

    void (async () => {
      try {
        setVerification(await lookupDeviceCode(initialUserCode));
      } catch {
        setVerification(null);
      }
    })();
  }, [initialUserCode]);

  return (
    <AuthCanvas>
      <Card className="w-full max-w-lg">
        <CardHeader className="p-4">
          <CardTitle className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Authorize a device
          </CardTitle>
          <CardDescription className="text-[length:var(--app-font-size-ui,12px)]">
            Enter the code shown by the CLI or other device you are authorizing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="user_code">User code</Label>
            <Input
              autoComplete="off"
              className="font-mono tracking-widest"
              id="user_code"
              onChange={(event) => {
                setUserCode(event.target.value);
                setVerification(null);
              }}
              placeholder="ABCD-1234"
              value={userCode}
            />
          </div>
          {verification ? (
            <div className="rounded-md border p-3 text-[length:var(--app-font-size-ui,12px)]">
              <p>
                <span className="font-medium">Client:</span>{' '}
                {verification.client_id ?? 'Unknown client'}
              </p>
              <p className="mt-2">
                <span className="font-medium">Scopes:</span>{' '}
                {verification.scope ?? 'Default scopes'}
              </p>
              <p className="mt-2">
                <span className="font-medium">Status:</span>{' '}
                {verification.status}
              </p>
            </div>
          ) : null}
          <p className="text-muted-foreground text-[length:var(--app-font-size-ui,12px)]">
            Only approve codes from devices in your possession. Do not enter
            codes sent by email, chat, or phone calls.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1"
              disabled={isSubmitting || userCode.trim().length === 0}
              variant="outline"
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  const result = await lookupDeviceCode(
                    normalizeUserCode(userCode)
                  );
                  setVerification(result);
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not verify device code'
                  );
                }
                setIsSubmitting(false);
              }}
            >
              Look up code
            </Button>
            <Button
              className="flex-1"
              disabled={
                isSubmitting || userCode.trim().length === 0 || !decisionAllowed
              }
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await postDeviceAction(
                    '/api/auth/device/approve',
                    normalizeUserCode(userCode)
                  );
                  toast.success('Device approved');
                  setVerification(null);
                  setUserCode('');
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not approve device'
                  );
                }
                setIsSubmitting(false);
              }}
            >
              Approve device
            </Button>
            <Button
              className="flex-1"
              disabled={
                isSubmitting || userCode.trim().length === 0 || !decisionAllowed
              }
              variant="destructive-outline"
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await postDeviceAction(
                    '/api/auth/device/deny',
                    normalizeUserCode(userCode)
                  );
                  toast.success('Device request denied');
                  setVerification(null);
                  setUserCode('');
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not deny device'
                  );
                }
                setIsSubmitting(false);
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

export const Route = createFileRoute('/device')({
  component: DevicePage,
  beforeLoad: async ({ location }) => {
    const callbackURL = callbackURLFromLocation(location);
    const session = await resolveSession();
    if (!session) {
      throw redirectToLogin(callbackURL);
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    user_code:
      typeof search.user_code === 'string' ? search.user_code : undefined,
  }),
});
