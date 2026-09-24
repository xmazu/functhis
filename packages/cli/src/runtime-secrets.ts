const SECRET_CALL_PATTERN =
  /\bsecret\s*\(\s*['"](?<name>[A-Z][A-Z0-9_]*|[A-Za-z][A-Za-z0-9_]*)['"]\s*\)/gu;

export const detectRuntimeSecretNames = (
  files: Record<string, string>
): string[] => {
  const names = new Set<string>();
  for (const content of Object.values(files)) {
    for (const match of content.matchAll(SECRET_CALL_PATTERN)) {
      const name = match.groups?.name;
      if (name) {
        names.add(name);
      }
    }
  }
  return [...names].toSorted();
};
