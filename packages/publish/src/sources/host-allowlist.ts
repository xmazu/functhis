export const hostAllowedForFetch = (
  url: string,
  allowlist: readonly string[] | undefined
): boolean => {
  if (allowlist === undefined) {
    return true;
  }
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowlist.some((entry) => entry.toLowerCase() === hostname);
};

export const assertHostAllowedForFetch = (
  url: string,
  allowlist: readonly string[] | undefined
): void => {
  if (!hostAllowedForFetch(url, allowlist)) {
    throw new Error(
      `Outbound fetch to ${url} is not on the package host allowlist.`
    );
  }
};
