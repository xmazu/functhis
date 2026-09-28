import { AXIOM_MAX_LOG_BYTES, AXIOM_MAX_LOGS } from './axiom';
import {
  TELEMETRY_REDACTED,
  TELEMETRY_SENSITIVE_KEY_PATTERN,
  TELEMETRY_SENSITIVE_VALUE_PATTERN,
} from './telemetry-redaction';

export const AXIOM_TAIL_MODULE_ID = './__functhis_axiom_tail.mjs';
export const AXIOM_REDACTION_MODULE_ID = './__functhis_axiom_redaction.mjs';

export const createAxiomRedactionModuleSource = (): string =>
  `const key = /${TELEMETRY_SENSITIVE_KEY_PATTERN}/iu;
const value = /${TELEMETRY_SENSITIVE_VALUE_PATTERN}/iu;
export const redact = (input, secrets = [], depth = 0) => {
  if (depth > 8) return '[TRUNCATED]';
  if (typeof input === 'string') {
    if (secrets.some((secret) => secret && input.includes(secret))) return '${TELEMETRY_REDACTED}';
    return input.replace(value, '${TELEMETRY_REDACTED}');
  }
  if (Array.isArray(input)) return input.map((item) => redact(item, secrets, depth + 1));
  if (input && typeof input === 'object') {
    const output = {};
    for (const [name, item] of Object.entries(input)) output[name] = key.test(name) ? '${TELEMETRY_REDACTED}' : redact(item, secrets, depth + 1);
    return output;
  }
  return input;
};`;

export const createAxiomTailModuleSource = (): string => `
import { redact } from '${AXIOM_REDACTION_MODULE_ID}';
const MAX_LOGS = ${AXIOM_MAX_LOGS};
const MAX_LOG_BYTES = ${AXIOM_MAX_LOG_BYTES};
const text = (value) => {
  try { return JSON.stringify(value) ?? String(value); } catch { return '[REDACTED]'; }
};
export default {
  async tail(events, env) {
    const secretValues = JSON.parse(env.REDACTION_SECRETS || '[]');
    const records = [];
    for (const event of events) {
      const logs = event?.logs || [];
      for (const log of logs) {
        if (records.length >= MAX_LOGS) break;
        const message = text(redact(log.message ?? log, secretValues)).slice(0, MAX_LOG_BYTES);
        const request = event?.event?.request;
        const headers = request?.headers || {};
        const executionId = headers['x-functhis-execution-id'] || headers['X-Functhis-Execution-Id'];
        if (!executionId) continue;
        records.push({
          executionId,
          ft_event_type: 'log',
          ft_execution_id: executionId,
          ft_function_slug:
            headers['x-functhis-function-slug'] ||
            headers['X-Functhis-Function-Slug'] ||
            '',
          ft_handle: env.HANDLE || '',
          ft_org_id: env.ORGANIZATION_ID || '',
          ft_package_slug: env.PACKAGE_SLUG || '',
          ft_version_id: env.VERSION_ID || '',
          functionSlug:
            headers['x-functhis-function-slug'] ||
            headers['X-Functhis-Function-Slug'] ||
            '',
          handle: env.HANDLE || '',
          level: log.level || 'log',
          message,
          organizationId: env.ORGANIZATION_ID || '',
          packageSlug: env.PACKAGE_SLUG || '',
          timestamp: log.timestamp || new Date().toISOString(),
          type: 'log',
          versionId: env.VERSION_ID || '',
        });
      }
    }
    if (records.length === 0) return;
    const edge = (env.AXIOM_EDGE || '').replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
    const ingestUrl = edge
      ? 'https://' + edge + '/v1/ingest/' + encodeURIComponent(env.AXIOM_DATASET)
      : 'https://api.axiom.co/v1/datasets/' + encodeURIComponent(env.AXIOM_DATASET) + '/ingest';
    const response = await fetch(ingestUrl, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.AXIOM_API_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify(records),
    });
    if (!response.ok) {
      throw new Error('axiom tail ingest failed');
    }
  }
};
`;
