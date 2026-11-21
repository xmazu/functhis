export type SecretBinding = string | { get: () => Promise<string> };

export const resolveSecret = async (value: SecretBinding): Promise<string> => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value.get === 'function') {
    return await value.get();
  }
  throw new Error(
    'Invalid secret binding: expected a string or a Secrets Store binding with get()'
  );
};
