import { existsSync } from 'node:fs';
import path from 'node:path';

import { Node, Project } from 'ts-morph';
import type {
  FunctionLikeDeclaration,
  JSDoc,
  SourceFile,
  Type,
} from 'ts-morph';

export interface FunctionContract {
  description: string;
  examples?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

const defaultCompilerOptions = {
  allowJs: true,
  strict: true,
} as const;

const anyJsonSchema = (): Record<string, unknown> => ({});

const openObjectSchema = (): Record<string, unknown> => ({
  additionalProperties: true,
  type: 'object',
});

const resolveCallable = (node: Node): FunctionLikeDeclaration | undefined => {
  if (Node.isFunctionDeclaration(node)) {
    return node;
  }
  if (Node.isFunctionExpression(node) || Node.isArrowFunction(node)) {
    return node;
  }
  if (Node.isExportAssignment(node)) {
    const expression = node.getExpression();
    if (
      Node.isFunctionExpression(expression) ||
      Node.isArrowFunction(expression)
    ) {
      return expression;
    }
  }
  if (Node.isVariableDeclaration(node)) {
    const initializer = node.getInitializer();
    if (
      initializer &&
      (Node.isFunctionExpression(initializer) ||
        Node.isArrowFunction(initializer))
    ) {
      return initializer;
    }
  }
  return undefined;
};

const jsDocFromDeclaration = (
  node: Node
): {
  description?: string;
  examples: string[];
  paramComments: Map<string, string>;
  returnsComment?: string;
} => {
  const empty = {
    examples: [] as string[],
    paramComments: new Map<string, string>(),
  };

  const readJsDoc = (jsDocable: { getJsDocs: () => JSDoc[] }) => {
    const [jsDoc] = jsDocable.getJsDocs();
    if (!jsDoc) {
      return empty;
    }
    const description = jsDoc.getDescription();
    const examples: string[] = [];
    const paramComments = new Map<string, string>();
    let returnsComment: string | undefined;

    for (const tag of jsDoc.getTags()) {
      const tagName = tag.getTagName();
      if (tagName === 'example') {
        const comment = tag.getCommentText()?.trim();
        if (comment) {
          examples.push(comment);
        }
      }
      if (tagName === 'param' && Node.isJSDocParameterTag(tag)) {
        const name = tag.getName();
        const comment = tag.getCommentText()?.trim();
        if (name && comment) {
          paramComments.set(name, comment);
        }
      }
      if (tagName === 'returns' || tagName === 'return') {
        const comment = tag.getCommentText()?.trim();
        if (comment) {
          returnsComment = comment;
        }
      }
    }

    return { description, examples, paramComments, returnsComment };
  };

  if (Node.isJSDocable(node) && node.getJsDocs().length > 0) {
    return readJsDoc(node);
  }
  if (Node.isExportAssignment(node)) {
    return empty;
  }
  const parent = node.getParent();
  if (
    parent &&
    Node.isExportAssignment(parent) &&
    Node.isJSDocable(parent) &&
    parent.getJsDocs().length > 0
  ) {
    return readJsDoc(parent);
  }
  return empty;
};

const inputParameterType = (
  callable: FunctionLikeDeclaration
): Type | undefined => {
  const inputParam = callable
    .getParameters()
    .find((parameter) => parameter.getName() === 'input');
  return inputParam?.getType();
};

const unwrapPromiseType = (type: Type): Type => {
  const symbolName = type.getSymbol()?.getName();
  if (symbolName === 'Promise') {
    const [inner] = type.getTypeArguments();
    if (inner) {
      return inner;
    }
  }
  return type;
};

const returnTypeOfCallable = (
  callable: FunctionLikeDeclaration
): Type | undefined => {
  const signature = callable.getSignature();
  if (!signature) {
    return undefined;
  }
  return unwrapPromiseType(signature.getReturnType());
};

const isVoidOrUndefinedType = (type: Type): boolean =>
  type.isUndefined() ||
  type.isVoid() ||
  type.getText() === 'void' ||
  type.getText() === 'undefined';

const nonNullableUnionMembers = (type: Type): Type[] =>
  type
    .getUnionTypes()
    .filter(
      (member) =>
        !member.isUndefined() &&
        !member.isNull() &&
        !isVoidOrUndefinedType(member)
    );

const scalarJsonSchema = (
  resolved: Type
): Record<string, unknown> | undefined => {
  if (resolved.isBoolean()) {
    return { type: 'boolean' };
  }
  if (resolved.isUnknown() || resolved.isAny()) {
    return anyJsonSchema();
  }
  if (resolved.isString()) {
    return { type: 'string' };
  }
  if (resolved.isNumber()) {
    return { type: 'number' };
  }
  return undefined;
};

const jsonSchema = {
  fromObject(type: Type): Record<string, unknown> | undefined {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    const objectProperties = type.getProperties();

    if (objectProperties.length === 0) {
      return openObjectSchema();
    }

    for (const property of objectProperties) {
      const name = property.getName();
      if (name.startsWith('__')) {
        continue;
      }
      const declaration = property.getValueDeclaration();
      if (!declaration) {
        properties[name] = anyJsonSchema();
        continue;
      }
      const propertyType = property.getTypeAtLocation(declaration);
      const propertySchema =
        jsonSchema.fromType(propertyType) ?? anyJsonSchema();
      properties[name] = propertySchema;
      const optional =
        Node.isPropertySignature(declaration) && declaration.hasQuestionToken();
      if (!optional) {
        required.push(name);
      }
    }

    if (Object.keys(properties).length === 0) {
      return openObjectSchema();
    }

    return {
      additionalProperties: false,
      properties,
      required,
      type: 'object',
    };
  },

  fromType(type: Type): Record<string, unknown> | undefined {
    if (type.isUnion()) {
      return jsonSchema.fromUnionMembers(nonNullableUnionMembers(type));
    }

    if (isVoidOrUndefinedType(type)) {
      return undefined;
    }

    const scalarSchema = scalarJsonSchema(type);
    if (scalarSchema) {
      return scalarSchema;
    }

    if (type.isArray()) {
      const elementType = type.getArrayElementType();
      if (!elementType) {
        return { type: 'array' };
      }
      const items = jsonSchema.fromType(elementType) ?? anyJsonSchema();
      return { items, type: 'array' };
    }
    if (!type.isObject()) {
      return anyJsonSchema();
    }

    return jsonSchema.fromObject(type);
  },

  fromUnionMembers(members: Type[]): Record<string, unknown> | undefined {
    if (members.length === 0) {
      return undefined;
    }
    if (members.length === 1) {
      const [only] = members;
      return only ? jsonSchema.fromType(only) : undefined;
    }
    if (members.every((member) => member.isBooleanLiteral())) {
      return { type: 'boolean' };
    }
    if (members.every((member) => member.isStringLiteral())) {
      return {
        enum: members.map((member) => member.getLiteralValue()),
        type: 'string',
      };
    }
    if (members.every((member) => member.isNumberLiteral())) {
      return {
        enum: members.map((member) => member.getLiteralValue()),
        type: 'number',
      };
    }
    return {
      anyOf: members.map(
        (member) => jsonSchema.fromType(member) ?? anyJsonSchema()
      ),
    };
  },
};

export const typeToJsonSchema = (
  type: Type
): Record<string, unknown> | undefined => jsonSchema.fromType(type);

const applyParamDescriptions = (
  schema: Record<string, unknown>,
  paramComments: Map<string, string>
): void => {
  if (schema.type !== 'object' || !schema.properties) {
    return;
  }
  const properties = schema.properties as Record<
    string,
    Record<string, unknown>
  >;
  for (const [name, propertySchema] of Object.entries(properties)) {
    const comment =
      paramComments.get(name) ?? paramComments.get(`input.${name}`);
    if (comment) {
      propertySchema.description = comment;
    }
    if (propertySchema.type === 'object' && propertySchema.properties) {
      applyParamDescriptions(propertySchema, paramComments);
    }
  }
};

interface CollectedJsDoc {
  description?: string;
  examples: string[];
  paramComments: Map<string, string>;
  returnsComment?: string;
}

const mergeJsDoc = (target: CollectedJsDoc, source: CollectedJsDoc): void => {
  if (!target.description && source.description) {
    target.description = source.description;
  }
  if (target.examples.length === 0 && source.examples.length > 0) {
    target.examples = source.examples;
  }
  for (const [key, value] of source.paramComments) {
    if (!target.paramComments.has(key)) {
      target.paramComments.set(key, value);
    }
  }
  if (!target.returnsComment && source.returnsComment) {
    target.returnsComment = source.returnsComment;
  }
};

const callableAndJsDocFromDefaultExport = (
  sourceFile: SourceFile
): {
  callable: FunctionLikeDeclaration;
  jsDoc: CollectedJsDoc;
} | null => {
  const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
  if (!defaultExportSymbol) {
    return null;
  }

  let callable: FunctionLikeDeclaration | undefined;
  const jsDoc: CollectedJsDoc = {
    examples: [],
    paramComments: new Map<string, string>(),
  };

  for (const declaration of defaultExportSymbol.getDeclarations()) {
    mergeJsDoc(jsDoc, jsDocFromDeclaration(declaration));
    callable ??= resolveCallable(declaration);
  }
  if (!callable) {
    return null;
  }
  return { callable, jsDoc };
};

const contractFromSourceFile = (
  sourceFile: SourceFile,
  slug: string
): FunctionContract | null => {
  const collected = callableAndJsDocFromDefaultExport(sourceFile);
  if (!collected) {
    return null;
  }
  const { callable, jsDoc } = collected;

  const trimmedDescription = jsDoc.description?.trim();
  const description =
    trimmedDescription && trimmedDescription.length > 0
      ? trimmedDescription
      : slug;
  const contract: FunctionContract = { description };
  if (jsDoc.examples.length > 0) {
    contract.examples = jsDoc.examples;
  }

  const inputType = inputParameterType(callable);
  if (inputType) {
    const inputSchema = typeToJsonSchema(inputType);
    if (inputSchema) {
      applyParamDescriptions(inputSchema, jsDoc.paramComments);
      contract.inputSchema = inputSchema;
    }
  }

  const returnType = returnTypeOfCallable(callable);
  if (returnType && !isVoidOrUndefinedType(returnType)) {
    const outputSchema = typeToJsonSchema(returnType);
    if (outputSchema) {
      if (jsDoc.returnsComment) {
        outputSchema.description = jsDoc.returnsComment;
      }
      contract.outputSchema = outputSchema;
    }
  }

  return contract;
};

export const buildFunctionContract = (options: {
  content: string;
  projectRoot: string;
  relativePath: string;
  slug: string;
}): FunctionContract | null => {
  const tsConfigPath = path.join(options.projectRoot, 'tsconfig.json');
  const project = new Project({
    compilerOptions: defaultCompilerOptions,
    ...(existsSync(tsConfigPath) ? { tsConfigFilePath: tsConfigPath } : {}),
  });

  const sourceFile = project.createSourceFile(
    options.relativePath,
    options.content,
    { overwrite: true }
  );

  return contractFromSourceFile(sourceFile, options.slug);
};
