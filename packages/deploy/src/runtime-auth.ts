import { RUNTIME_EXECUTE_SECRET_HEADER } from './constants';

export const isRuntimeExecuteAuthorized = (
  request: Request,
  secret: string | undefined
): boolean => {
  if (!secret) {
    return false;
  }
  const provided = request.headers.get(RUNTIME_EXECUTE_SECRET_HEADER);
  return provided !== null && provided.length > 0 && provided === secret;
};

export const runtimeExecuteSecretHeaders = (
  secret: string
): Record<string, string> => ({
  [RUNTIME_EXECUTE_SECRET_HEADER]: secret,
});
