export type SecretBinding = string | { get: () => Promise<string> };

export const resolveSecret = async (value: SecretBinding): Promise<string> => {
  if (typeof value === 'string') {
    return value;
  }
  return await value.get();
};
