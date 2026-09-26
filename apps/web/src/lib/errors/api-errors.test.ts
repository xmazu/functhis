import { describe, expect, it } from 'bun:test';

import { ApiError, createApiErrors, isApiError } from './api-errors';

type Code = 'INVALID_REQUEST' | 'FORBIDDEN' | 'INTERNAL_ERROR';

const errors = createApiErrors<Code>({
  internalCode: 'INTERNAL_ERROR',
  statusByCode: {
    FORBIDDEN: 403,
    INTERNAL_ERROR: 500,
    INVALID_REQUEST: 400,
  },
});

describe('createApiErrors', () => {
  it('derives the http status from the code map', () => {
    expect(errors.apiError('FORBIDDEN', 'Nope').httpStatus).toBe(403);
    expect(errors.apiError('INVALID_REQUEST', 'Bad').httpStatus).toBe(400);
  });

  it('builds an envelope carrying the request id', () => {
    const error = errors.apiError('INVALID_REQUEST', 'Bad body', [
      { message: 'Required', path: 'data.email' },
    ]);

    expect(error.toBody('req_1')).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        details: [{ message: 'Required', path: 'data.email' }],
        message: 'Bad body',
        requestId: 'req_1',
      },
    });
  });

  it('never leaks the message of an unexpected error', () => {
    const converted = errors.toApiError(
      new Error('connection string postgres://user:hunter2@host/db failed')
    );

    expect(converted.code).toBe('INTERNAL_ERROR');
    expect(converted.httpStatus).toBe(500);
    expect(converted.message).toBe('Unexpected error');
  });

  it('recognises its errors through the shared base class', () => {
    expect(isApiError(errors.apiError('FORBIDDEN', 'Nope'))).toBe(true);
    expect(isApiError(new Error('plain'))).toBe(false);
    expect(errors.apiError('FORBIDDEN', 'Nope')).toBeInstanceOf(ApiError);
  });
});
