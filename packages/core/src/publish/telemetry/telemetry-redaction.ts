export const TELEMETRY_SENSITIVE_KEY_PATTERN =
  '(?:authorization|cookie|password|passwd|secret|token|api[-_]?key|private[-_]?key|set-cookie|stack|trace)';
export const TELEMETRY_SENSITIVE_VALUE_PATTERN =
  '(?:bearer\\s+|basic\\s+)[a-z0-9._~+/=-]+';

const SENSITIVE_KEY = new RegExp(TELEMETRY_SENSITIVE_KEY_PATTERN, 'iu');
const SENSITIVE_VALUE = new RegExp(TELEMETRY_SENSITIVE_VALUE_PATTERN, 'iu');

export const TELEMETRY_REDACTED = '[REDACTED]';

export const redactTelemetry = (
  value: unknown,
  secretValues: readonly string[] = [],
  depth = 0
): unknown => {
  if (depth > 8) {
    return '[TRUNCATED]';
  }
  if (typeof value === 'string') {
    if (
      secretValues.some((secret) => secret.length > 0 && value.includes(secret))
    ) {
      return TELEMETRY_REDACTED;
    }
    return value.replace(SENSITIVE_VALUE, TELEMETRY_REDACTED);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactTelemetry(item, secretValues, depth + 1));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY.test(key)
        ? TELEMETRY_REDACTED
        : redactTelemetry(item, secretValues, depth + 1);
    }
    return result;
  }
  return value;
};

export const redactTelemetryJson = (
  value: unknown,
  secretValues: readonly string[] = []
): string => {
  try {
    return JSON.stringify(redactTelemetry(value, secretValues)) ?? 'null';
  } catch {
    return TELEMETRY_REDACTED;
  }
};
