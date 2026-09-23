import { utf8ByteLength } from './bundle';
import {
  MAX_EXECUTE_REQUEST_BYTES,
  MAX_EXECUTE_RESPONSE_BYTES,
} from './constants';

export type ExecuteSizeKind = 'request' | 'response';

export class ExecutePayloadTooLargeError extends Error {
  readonly kind: ExecuteSizeKind;
  readonly maxBytes: number;
  readonly actualBytes: number;

  constructor(kind: ExecuteSizeKind, actualBytes: number) {
    const maxBytes =
      kind === 'request'
        ? MAX_EXECUTE_REQUEST_BYTES
        : MAX_EXECUTE_RESPONSE_BYTES;
    super(
      `Execute ${kind} payload too large (${actualBytes} bytes, max ${maxBytes})`
    );
    this.name = 'ExecutePayloadTooLargeError';
    this.kind = kind;
    this.maxBytes = maxBytes;
    this.actualBytes = actualBytes;
  }
}

export const executeRequestByteLength = (body: string): number =>
  utf8ByteLength(body);

export const assertExecuteRequestSize = (body: string): void => {
  const bytes = executeRequestByteLength(body);
  if (bytes > MAX_EXECUTE_REQUEST_BYTES) {
    throw new ExecutePayloadTooLargeError('request', bytes);
  }
};

export const assertExecuteResponseSize = (body: string): void => {
  const bytes = utf8ByteLength(body);
  if (bytes > MAX_EXECUTE_RESPONSE_BYTES) {
    throw new ExecutePayloadTooLargeError('response', bytes);
  }
};
