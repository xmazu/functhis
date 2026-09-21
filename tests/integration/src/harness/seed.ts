import { ensureCliOAuthClient } from '@functhis/auth/seed-cli-client';
import type { Database } from '@functhis/db';
import { oauthAccessToken, user } from '@functhis/db/schema/auth';
import { DEPLOY_API_RESOURCE } from '@functhis/deploy';
import { CLI_CLIENT_ID } from '@functhis/deploy/oauth';

export interface IntegrationDeployAuth {
  accessToken: string;
  userId: string;
}

export const seedIntegrationDeployAuth = async (
  db: Database,
  suffix: string
): Promise<IntegrationDeployAuth> => {
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

  await db.insert(oauthAccessToken).values({
    clientId: CLI_CLIENT_ID,
    createdAt: now,
    expiresAt,
    resources: [DEPLOY_API_RESOURCE],
    scopes: ['openid'],
    token: accessToken,
    userId: insertedUser.id,
  });

  return { accessToken, userId: insertedUser.id };
};
