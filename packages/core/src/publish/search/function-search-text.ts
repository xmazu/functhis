const schemaPropertyLines = (schema: unknown, prefix = ''): string[] => {
  if (!schema || typeof schema !== 'object') {
    return [];
  }
  const record = schema as Record<string, unknown>;
  if (record.type !== 'object' || !record.properties) {
    return [];
  }
  const properties = record.properties as Record<
    string,
    Record<string, unknown>
  >;
  const lines: string[] = [];
  for (const [name, property] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${name}` : name;
    lines.push(path);
    const { description } = property;
    if (typeof description === 'string' && description.trim().length > 0) {
      lines.push(description.trim());
    }
    lines.push(...schemaPropertyLines(property, path));
  }
  return lines;
};

export const buildFunctionSearchText = (input: {
  contract: Record<string, unknown>;
  slug: string;
}): string => {
  const parts: string[] = [input.slug];
  const { description } = input.contract;
  if (typeof description === 'string' && description.trim().length > 0) {
    parts.push(description.trim());
  }
  const { examples } = input.contract;
  if (Array.isArray(examples)) {
    for (const example of examples) {
      if (typeof example === 'string' && example.trim().length > 0) {
        parts.push(example.trim());
      }
    }
  }
  parts.push(
    ...schemaPropertyLines(input.contract.inputSchema),
    ...schemaPropertyLines(input.contract.outputSchema)
  );
  return parts.join('\n');
};
