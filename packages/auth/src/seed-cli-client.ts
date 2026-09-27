import type { Database } from '@functhis/db';
import {
  oauthClient,
  oauthClientResource,
  oauthResource,
} from '@functhis/db/schema/auth';
import {
  CLI_CLIENT_ID,
  CURSOR_MCP_CLIENT_ID,
  CURSOR_MCP_REDIRECT_URIS,
  MCP_RESOURCE_PRODUCTION,
  PUBLISH_API_RESOURCE,
} from '@functhis/publish/oauth';
import { oauthResourceIdentifierVariants } from '@functhis/publish/oauth-resource';

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
      identifier: PUBLISH_API_RESOURCE,
      name: 'Functhis publish API',
      updatedAt: now,
    })
    .onConflictDoNothing({ target: oauthResource.identifier });

  await Promise.all(
    oauthResourceIdentifierVariants(mcpResourceIdentifier).map((identifier) =>
      database
        .insert(oauthResource)
        .values({
          createdAt: now,
          disabled: false,
          identifier,
          name: 'Functhis MCP',
          updatedAt: now,
        })
        .onConflictDoNothing({ target: oauthResource.identifier })
    )
  );

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
      resourceId: PUBLISH_API_RESOURCE,
    })
    .onConflictDoNothing({
      target: [oauthClientResource.clientId, oauthClientResource.resourceId],
    });
};

/** Cursor IDE does not use CIMD; it needs a static client (`auth.CLIENT_ID` in `.cursor/mcp.json`). */
export const ensureCursorMcpOAuthClient = async (
  database: Database,
  mcpResourceIdentifier: string
): Promise<void> => {
  const now = new Date();

  await database
    .insert(oauthClient)
    .values({
      applicationType: 'native',
      clientId: CURSOR_MCP_CLIENT_ID,
      createdAt: now,
      disabled: false,
      grantTypes: ['authorization_code', 'refresh_token'],
      name: 'Cursor MCP',
      redirectUris: [...CURSOR_MCP_REDIRECT_URIS],
      requirePKCE: true,
      responseTypes: ['code'],
      skipConsent: false,
      tokenEndpointAuthMethod: 'none',
      updatedAt: now,
    })
    .onConflictDoNothing({ target: oauthClient.clientId });

  await Promise.all(
    oauthResourceIdentifierVariants(mcpResourceIdentifier).map((resourceId) =>
      database
        .insert(oauthClientResource)
        .values({
          clientId: CURSOR_MCP_CLIENT_ID,
          createdAt: now,
          resourceId,
        })
        .onConflictDoNothing({
          target: [
            oauthClientResource.clientId,
            oauthClientResource.resourceId,
          ],
        })
    )
  );
};
