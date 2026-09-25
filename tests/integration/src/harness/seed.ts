import { ensureCliOAuthClient } from '@functhis/auth/seed-cli-client';
import type { Database } from '@functhis/db';
import {
  member,
  oauthAccessToken,
  organization,
  user,
} from '@functhis/db/schema/auth';
import { PUBLISH_API_RESOURCE } from '@functhis/publish';
import { CLI_CLIENT_ID } from '@functhis/publish/oauth';
import { eq } from 'drizzle-orm';

export interface IntegrationPublishAuth {
  accessToken: string;
  handle: string;
  userId: string;
}

export const seedIntegrationPublishAuth = async (
  db: Database,
  suffix: string
): Promise<IntegrationPublishAuth> => {
  await ensureCliOAuthClient(db);

  const handle = `int_db_${suffix}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
  const accessToken = `int_token_${suffix}`;

  const [insertedUser] = await db
    .insert(user)
    .values({
      email: `${handle}@integration.local`,
      handle,
      name: `Integration ${suffix}`,
    })
    .returning({ id: user.id });

  if (!insertedUser) {
    throw new Error('Failed to seed integration user');
  }

  await db.insert(organization).values({
    createdAt: now,
    name: `Integration ${suffix}`,
    slug: handle,
  });

  const [insertedOrg] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, handle))
    .limit(1);

  if (!insertedOrg) {
    throw new Error('Failed to seed integration organization');
  }

  await db.insert(member).values({
    createdAt: now,
    organizationId: insertedOrg.id,
    role: 'owner',
    userId: insertedUser.id,
  });

  await db.insert(oauthAccessToken).values({
    clientId: CLI_CLIENT_ID,
    createdAt: now,
    expiresAt,
    resources: [PUBLISH_API_RESOURCE],
    scopes: ['openid'],
    token: accessToken,
    userId: insertedUser.id,
  });

  return { accessToken, handle, userId: insertedUser.id };
};

export const seedIntegrationOrganization = async (
  db: Database,
  input: { slug: string; userIds: string[] }
): Promise<{ organizationId: string; slug: string }> => {
  const [org] = await db
    .insert(organization)
    .values({
      createdAt: new Date(),
      name: input.slug,
      slug: input.slug,
    })
    .returning({ id: organization.id });

  if (!org) {
    throw new Error('Failed to seed integration organization');
  }

  await db.insert(member).values(
    input.userIds.map((userId) => ({
      createdAt: new Date(),
      organizationId: org.id,
      role: 'member',
      userId,
    }))
  );

  return { organizationId: org.id, slug: input.slug };
};
