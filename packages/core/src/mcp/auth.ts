import type { AuditableLogger } from 'evlog';

import type { McpBindings } from './bindings';

export interface McpAuthenticateSuccess {
  userId: string;
}

/** Return a `userId` on success or an HTTP `Response` (for example 401) on failure. */
export type McpAuthenticate = (
  request: Request,
  bindings: McpBindings,
  log?: AuditableLogger
) => Promise<McpAuthenticateSuccess | Response>;

export const isMcpAuthResponse = (
  result: McpAuthenticateSuccess | Response
): result is Response => result instanceof Response;
