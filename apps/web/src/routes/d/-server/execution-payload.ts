export type ExecutionPayloadState =
  | 'available'
  | 'expired'
  | 'missing'
  | 'unavailable';
export type SerializableValue =
  | boolean
  | null
  | number
  | string
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export interface ExecutionPayload {
  input: SerializableValue;
  logs: { level: string; message: string; timestamp: string }[];
  output: SerializableValue;
}

export const unavailableExecutionPayload = (): {
  payload: null;
  payloadState: 'unavailable';
} => ({ payload: null, payloadState: 'unavailable' });

const executionReferenceTime = (
  startedAt: Date | null,
  createdAt: Date
): Date => startedAt ?? createdAt;

export const executionPayloadFromAxiomRecords = (
  records: readonly Record<string, unknown>[],
  options: {
    createdAt: Date;
    logRetentionDays: number;
    startedAt: Date | null;
  }
): {
  payload: ExecutionPayload | null;
  payloadState: ExecutionPayloadState;
} => {
  if (records.length === 0) {
    const referenceTime = executionReferenceTime(
      options.startedAt,
      options.createdAt
    );
    const retentionMs = options.logRetentionDays * 86_400_000;
    if (options.logRetentionDays === 0) {
      return { payload: null, payloadState: 'expired' };
    }
    const withinRetention = Date.now() - referenceTime.getTime() <= retentionMs;
    return {
      payload: null,
      payloadState: withinRetention ? 'missing' : 'expired',
    };
  }

  const event = records.find(
    (record) => 'input' in record || 'output' in record
  );
  const logs = records
    .filter((record) => record.type === 'log' || 'message' in record)
    .map((record) => ({
      level: typeof record.level === 'string' ? record.level : 'log',
      message: typeof record.message === 'string' ? record.message : '',
      timestamp:
        typeof record.timestamp === 'string'
          ? record.timestamp
          : new Date().toISOString(),
    }));

  return {
    payload: {
      input: (event?.input ?? null) as SerializableValue,
      logs,
      output: (event?.output ?? null) as SerializableValue,
    },
    payloadState: 'available',
  };
};
