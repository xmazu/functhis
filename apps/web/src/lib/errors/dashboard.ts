import { createApiErrors } from '#/lib/errors/api-errors';

export const DASHBOARD_ERROR_CODES = [
  'UNAUTHORIZED',
  'NOT_FOUND',
  'INVALID_REQUEST',
  'INTERNAL_ERROR',
] as const;

export type DashboardErrorCode = (typeof DASHBOARD_ERROR_CODES)[number];

export const dashboardApiErrors = createApiErrors<DashboardErrorCode>({
  internalCode: 'INTERNAL_ERROR',
  internalMessage: 'Something went wrong',
  statusByCode: {
    INTERNAL_ERROR: 500,
    INVALID_REQUEST: 400,
    NOT_FOUND: 404,
    UNAUTHORIZED: 401,
  },
});

export const messageFromUnknown = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.message;
  }
  return dashboardApiErrors.toApiError(cause).message;
};
