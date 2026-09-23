export interface ContractInputValidationIssue {
  instancePath: string;
  message?: string;
}

export type ContractInputValidationResult =
  | { issues: ContractInputValidationIssue[]; ok: false }
  | { ok: true };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const childPath = (instancePath: string, key: string): string =>
  `${instancePath}/${key}`;

const fail = (
  instancePath: string,
  message: string
): ContractInputValidationResult => ({
  issues: [{ instancePath, message }],
  ok: false,
});

const jsonSchema = {
  byType(
    type: string,
    schema: Record<string, unknown>,
    value: unknown,
    instancePath: string
  ): ContractInputValidationResult {
    if (type === 'string') {
      return typeof value === 'string'
        ? { ok: true }
        : fail(instancePath, 'must be string');
    }
    if (type === 'number') {
      return typeof value === 'number' && Number.isFinite(value)
        ? { ok: true }
        : fail(instancePath, 'must be number');
    }
    if (type === 'boolean') {
      return typeof value === 'boolean'
        ? { ok: true }
        : fail(instancePath, 'must be boolean');
    }
    if (type === 'array') {
      if (!Array.isArray(value)) {
        return fail(instancePath, 'must be array');
      }
      const { items } = schema;
      if (items === undefined || typeof items !== 'object' || items === null) {
        return { ok: true };
      }
      const issues: ContractInputValidationIssue[] = [];
      for (const [index, element] of value.entries()) {
        const result = jsonSchema.validate(
          items as Record<string, unknown>,
          element,
          childPath(instancePath, String(index))
        );
        if (!result.ok) {
          issues.push(...result.issues);
        }
      }
      return issues.length > 0 ? { issues, ok: false } : { ok: true };
    }
    if (type === 'object') {
      if (!isPlainObject(value)) {
        return fail(instancePath, 'must be object');
      }
      return jsonSchema.object(schema, value, instancePath);
    }
    return { ok: true };
  },

  object(
    schema: Record<string, unknown>,
    value: Record<string, unknown>,
    instancePath: string
  ): ContractInputValidationResult {
    const issues: ContractInputValidationIssue[] = [];
    const properties =
      schema.properties && typeof schema.properties === 'object'
        ? (schema.properties as Record<string, unknown>)
        : {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter((entry) => typeof entry === 'string')
      : [];

    for (const name of required) {
      if (value[name] === undefined) {
        issues.push({
          instancePath: childPath(instancePath, name),
          message: 'must have required property',
        });
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          issues.push({
            instancePath: childPath(instancePath, key),
            message: 'must NOT have additional properties',
          });
        }
      }
    }

    for (const [name, propertySchema] of Object.entries(properties)) {
      if (value[name] === undefined) {
        continue;
      }
      if (typeof propertySchema !== 'object' || propertySchema === null) {
        continue;
      }
      const result = jsonSchema.validate(
        propertySchema as Record<string, unknown>,
        value[name],
        childPath(instancePath, name)
      );
      if (!result.ok) {
        issues.push(...result.issues);
      }
    }

    return issues.length > 0 ? { issues, ok: false } : { ok: true };
  },

  validate(
    schema: Record<string, unknown>,
    value: unknown,
    instancePath: string
  ): ContractInputValidationResult {
    const { anyOf } = schema;
    if (Array.isArray(anyOf) && anyOf.length > 0) {
      for (const option of anyOf) {
        if (typeof option !== 'object' || option === null) {
          continue;
        }
        const result = jsonSchema.validate(
          option as Record<string, unknown>,
          value,
          instancePath
        );
        if (result.ok) {
          return { ok: true };
        }
      }
      return fail(instancePath, 'must match a schema in anyOf');
    }

    if (Array.isArray(schema.enum)) {
      const matched = schema.enum.some((entry) => Object.is(entry, value));
      if (!matched) {
        return fail(instancePath, 'must be equal to one of the allowed values');
      }
    }

    if (typeof schema.type !== 'string') {
      return { ok: true };
    }

    return jsonSchema.byType(schema.type, schema, value, instancePath);
  },
};

export const validateContractInput = (
  inputSchema: unknown,
  value: unknown
): ContractInputValidationResult => {
  if (
    inputSchema === null ||
    inputSchema === undefined ||
    typeof inputSchema !== 'object'
  ) {
    return { ok: true };
  }

  return jsonSchema.validate(inputSchema as Record<string, unknown>, value, '');
};
