import { Button } from '@functhis/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@functhis/ui/components/card';
import { Input } from '@functhis/ui/components/input';
import { Label } from '@functhis/ui/components/label';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { resolveSession } from '@/functions/resolve-session';
import { lookupDeviceCode, postDeviceAction } from '@/lib/device-api';
import type { DeviceVerification } from '@/lib/device-api';

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
    <main className="mx-auto flex max-w-lg flex-1 items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Authorize a device</CardTitle>
          <CardDescription>
            Enter the code shown by the CLI or other device you are authorizing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user_code">User code</Label>
            <Input
              autoComplete="off"
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
            <div className="rounded-md border p-4 text-sm">
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
          <p className="text-muted-foreground text-sm">
            Only approve codes from devices in your possession. Do not enter
            codes sent by email, chat, or phone calls.
          </p>
          <div className="flex gap-2">
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
              variant="outline"
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
    </main>
  );
};

export const Route = createFileRoute('/device')({
  component: DevicePage,
  beforeLoad: async () => {
    const session = await resolveSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    user_code:
      typeof search.user_code === 'string' ? search.user_code : undefined,
  }),
});
