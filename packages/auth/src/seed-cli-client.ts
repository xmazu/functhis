import type { Database } from '@functhis/db';
import {
  oauthClient,
  oauthClientResource,
  oauthResource,
} from '@functhis/db/schema/auth';
import {
  CLI_CLIENT_ID,
  DEPLOY_API_RESOURCE,
  MCP_RESOURCE_PRODUCTION,
} from '@functhis/deploy';

const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

export const ensureCliOAuthClient = async (
  database: Database,
  mcpResourceIdentifier: string = MCP_RESOURCE_PRODUCTION
): Promise<void> => {
  const now = new Date();

  await database
    .insert(oauthResource)
    .values({
      createdAt: now,
      disabled: false,
      identifier: DEPLOY_API_RESOURCE,
      name: 'Functhis deploy API',
      updatedAt: now,
    })
    .onConflictDoNothing({ target: oauthResource.identifier });

  await database
    .insert(oauthResource)
    .values({
      createdAt: now,
      disabled: false,
      identifier: mcpResourceIdentifier,
      name: 'Functhis MCP',
      updatedAt: now,
    })
    .onConflictDoNothing({ target: oauthResource.identifier });

  await database
    .insert(oauthClient)
    .values({
      applicationType: 'native',
      clientId: CLI_CLIENT_ID,
      createdAt: now,
      disabled: false,
      grantTypes: [DEVICE_CODE_GRANT, 'refresh_token'],
      name: 'Functhis CLI',
      redirectUris: [],
      skipConsent: false,
      tokenEndpointAuthMethod: 'none',
      updatedAt: now,
    })
    .onConflictDoNothing({ target: oauthClient.clientId });

  await database
    .insert(oauthClientResource)
    .values({
      clientId: CLI_CLIENT_ID,
      createdAt: now,
      resourceId: DEPLOY_API_RESOURCE,
    })
    .onConflictDoNothing({
      target: [oauthClientResource.clientId, oauthClientResource.resourceId],
    });
};
