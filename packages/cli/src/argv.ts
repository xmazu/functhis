export const parseBooleanFlag = (args: string[], name: string): boolean =>
  args.includes(name);

export const parseFlag = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
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
