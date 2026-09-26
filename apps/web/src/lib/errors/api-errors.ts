/** Runtime-agnostic public API error envelope. */

export interface ErrorDetail {
  path?: string;
  message: string;
}

export interface ErrorBody<TCode extends string = string> {
  error: {
    code: TCode;
    message: string;
    details: ErrorDetail[];
    requestId: string;
  };
}

export interface ApiErrorInput<TCode extends string = string> {
  code: TCode;
  httpStatus: number;
  message: string;
  details?: ErrorDetail[];
}

export class ApiError<TCode extends string = string> extends Error {
  readonly code: TCode;
  readonly httpStatus: number;
  readonly details: ErrorDetail[];

  constructor(input: ApiErrorInput<TCode>) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.details = input.details ?? [];
  }

  toBody(requestId: string): ErrorBody<TCode> {
    return {
      error: {
        code: this.code,
        details: this.details,
        message: this.message,
        requestId,
      },
    };
  }
}

export const isApiError = <TCode extends string = string>(
  value: unknown
): value is ApiError<TCode> => value instanceof ApiError;

export interface ApiErrorsConfig<TCode extends string> {
  statusByCode: Record<TCode, number>;
  internalCode: TCode;
  internalMessage?: string;
}

export interface ApiErrors<TCode extends string> {
  apiError: (
    code: TCode,
    message: string,
    details?: ErrorDetail[]
  ) => ApiError<TCode>;
  toApiError: (cause: unknown) => ApiError<TCode>;
}

export const createApiErrors = <TCode extends string>(
  config: ApiErrorsConfig<TCode>
): ApiErrors<TCode> => {
  const internalMessage = config.internalMessage ?? 'Unexpected error';

  const apiError = (
    code: TCode,
    message: string,
    details?: ErrorDetail[]
  ): ApiError<TCode> =>
    new ApiError({
      code,
      details,
      httpStatus: config.statusByCode[code],
      message,
    });

  const toApiError = (cause: unknown): ApiError<TCode> => {
    if (isApiError<TCode>(cause)) {
      return cause;
    }
    return apiError(config.internalCode, internalMessage);
  };

  return { apiError, toApiError };
};
