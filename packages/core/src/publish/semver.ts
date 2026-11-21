export type VersionBump = 'major' | 'minor' | 'patch';

const SEMVER_PATTERN = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/u;

export const isValidSemver = (value: string): boolean =>
  SEMVER_PATTERN.test(value);

export const parseSemver = (
  value: string
): { major: number; minor: number; patch: number } | null => {
  const match = SEMVER_PATTERN.exec(value);
  if (!match?.groups) {
    return null;
  }
  return {
    major: Number(match.groups.major),
    minor: Number(match.groups.minor),
    patch: Number(match.groups.patch),
  };
};

export const compareSemver = (left: string, right: string): number => {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) {
    return left.localeCompare(right);
  }
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  return a.patch - b.patch;
};

export const highestSemver = (versions: readonly string[]): string | null => {
  const valid = versions.filter((version) => isValidSemver(version));
  if (valid.length === 0) {
    return null;
  }
  let highest = valid[0] ?? null;
  for (const current of valid) {
    if (highest !== null && compareSemver(current, highest) > 0) {
      highest = current;
    }
  }
  return highest;
};

export const bumpSemver = (
  current: string | null,
  bump: VersionBump
): string => {
  if (current === null) {
    return '1.0.0';
  }
  const parsed = parseSemver(current);
  if (!parsed) {
    return '1.0.0';
  }
  if (bump === 'major') {
    return `${parsed.major + 1}.0.0`;
  }
  if (bump === 'minor') {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
};
