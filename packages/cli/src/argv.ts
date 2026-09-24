export const parseBooleanFlag = (args: string[], name: string): boolean =>
  args.includes(name);

export const parseFlag = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
};

export const parseSecretFlags = (args: string[]): Record<string, string> => {
  const secrets: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--secret') {
      continue;
    }
    const pair = args[index + 1];
    if (!pair || pair.startsWith('--')) {
      throw new Error('Usage: --secret NAME=value');
    }
    const separator = pair.indexOf('=');
    if (separator <= 0) {
      throw new Error(`Invalid --secret "${pair}". Use NAME=value.`);
    }
    secrets[pair.slice(0, separator)] = pair.slice(separator + 1);
    index += 1;
  }
  return secrets;
};

export const parseJsonInput = (
  raw: string | undefined
): { ok: true; value: unknown } | { ok: false; error: string } => {
  if (raw === undefined) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { error: 'Invalid JSON for --input', ok: false };
  }
};
