import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { invitationIdFromInviteResponse } from '@/lib/organization-invite';

const inviteAcceptUrl = (invitationId: string): string =>
  `${globalThis.location.origin}/accept-invitation/${invitationId}`;

const OrganizationDetailPage = () => {
  const { slug } = Route.useParams();
  const { data: organizations } = authClient.useListOrganizations();
  const organization = (organizations ?? []).find((org) => org.slug === slug);
  const [members, setMembers] = useState<
    { email: string; id: string; role: string; userId: string }[]
  >([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization?.id) {
      return;
    }
    const load = async (): Promise<void> => {
      const { data } = await authClient.organization.listMembers({
        query: {
          organizationId: organization.id,
        },
      });
      if (data) {
        setMembers(
          data.members.map((memberRow) => ({
            email: memberRow.user.email,
            id: memberRow.id,
            role: memberRow.role,
            userId: memberRow.userId,
          }))
        );
      }
    };
    void load();
  }, [organization?.id]);

  const handleInvite = async (): Promise<void> => {
    if (!organization?.id) {
      return;
    }
    setError(null);
    setInviteLink(null);
    const { data, error: inviteError } =
      await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        organizationId: organization.id,
        role: 'member',
      });
    if (inviteError) {
      setError(inviteError.message ?? 'Invite failed');
      return;
    }
    const invitationId = invitationIdFromInviteResponse(data);
    if (invitationId) {
      setInviteLink(inviteAcceptUrl(invitationId));
    }
    setInviteEmail('');
  };

  if (!organization) {
    return (
      <main className="flex min-h-0 flex-1 flex-col p-4">
        <p className="text-[length:var(--app-font-size-ui,12px)]">
          Organization not found.
        </p>
        <Link
          className="mt-2 text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
          to="/organizations"
        >
          Back to organizations
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 py-2.5">
        <h1 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
          {organization.name}
        </h1>
        <p className="text-muted-foreground font-mono text-[length:var(--app-font-size-ui,12px)]">
          {organization.slug}
        </p>
      </header>
      <div className="flex flex-col gap-4 p-4">
        <section className="flex max-w-md flex-col gap-2 border p-3">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Invite member
          </h2>
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              onChange={(event) => {
                setInviteEmail(event.target.value);
              }}
              type="email"
              value={inviteEmail}
            />
          </div>
          {error ? (
            <p className="text-destructive text-[length:var(--app-font-size-ui,12px)]">
              {error}
            </p>
          ) : null}
          {inviteLink ? (
            <p className="font-mono text-[11px] leading-relaxed break-all">
              Share this link: {inviteLink}
            </p>
          ) : null}
          <Button
            disabled={inviteEmail.trim().length === 0}
            onClick={() => {
              void handleInvite();
            }}
            size="sm"
          >
            Invite member
          </Button>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-[length:var(--app-font-size-ui,12px)] font-medium">
            Members
          </h2>
          <ul className="flex flex-col gap-1">
            {members.map((member) => (
              <li
                className="text-[length:var(--app-font-size-ui,12px)]"
                key={member.id}
              >
                {member.email} · {member.role}
              </li>
            ))}
          </ul>
        </section>
        <Link
          className="text-[length:var(--app-font-size-ui,12px)] underline-offset-2 hover:underline"
          to="/organizations"
        >
          Back to organizations
        </Link>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/_auth/organizations/$slug')({
  component: OrganizationDetailPage,
});
