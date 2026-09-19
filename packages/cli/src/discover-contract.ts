import { existsSync } from 'node:fs';
import path from 'node:path';

import { Node, Project } from 'ts-morph';
import type { FunctionLikeDeclaration, SourceFile, Type } from 'ts-morph';

export interface FunctionContract {
  description: string;
  inputSchema?: Record<string, unknown>;
}

const defaultCompilerOptions = {
  allowJs: true,
  strict: true,
} as const;

export const firstParagraph = (
  text: string | undefined,
  slug: string
): string => {
  if (!text?.trim()) {
    return slug;
  }
  const paragraph =
    text
      .trim()
      .split(/\n\s*\n/u)[0]
      ?.trim() ?? text.trim();
  return paragraph.length > 0 ? paragraph : slug;
};

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

const jsDocDescriptionFromDeclaration = (node: Node): string | undefined => {
  if (Node.isJSDocable(node)) {
    const direct = node.getJsDocs()[0]?.getDescription();
    if (direct) {
      return direct;
    }
  }
  if (Node.isExportAssignment(node)) {
    return undefined;
  }
  const parent = node.getParent();
  if (parent && Node.isExportAssignment(parent) && Node.isJSDocable(parent)) {
    return parent.getJsDocs()[0]?.getDescription();
  }
  return undefined;
};

const inputParameterType = (
  callable: FunctionLikeDeclaration
): Type | undefined => {
  const inputParam = callable
    .getParameters()
    .find((parameter) => parameter.getName() === 'input');
  return inputParam?.getType();
};

const stripUndefinedFromUnion = (type: Type): Type | undefined => {
  if (!type.isUnion()) {
    return type;
  }
  const members = type
    .getUnionTypes()
    .filter((member) => !member.isUndefined());
  if (members.length !== 1) {
    return undefined;
  }
  return members[0];
};

const booleanSchemaFromType = (type: Type): Record<string, unknown> | null => {
  if (type.isBoolean()) {
    return { type: 'boolean' };
  }
  if (!type.isUnion()) {
    return null;
  }
  const unionMembers = type.getUnionTypes();
  if (
    unionMembers.length > 0 &&
    unionMembers.every((member) => member.isBooleanLiteral())
  ) {
    return { type: 'boolean' };
  }
  return null;
};

export const typeToInputSchema = (
  type: Type,
  options?: { allowUndefinedUnion: boolean }
): Record<string, unknown> | undefined => {
  const resolved =
    options?.allowUndefinedUnion === true
      ? (stripUndefinedFromUnion(type) ?? type)
      : type;

  const booleanSchema = booleanSchemaFromType(resolved);
  if (booleanSchema) {
    return booleanSchema;
  }
  if (resolved.isUnion()) {
    return undefined;
  }
  if (resolved.isUnknown() || resolved.isAny()) {
    return { additionalProperties: true, type: 'object' };
  }
  if (resolved.isString()) {
    return { type: 'string' };
  }
  if (resolved.isNumber()) {
    return { type: 'number' };
  }
  if (resolved.isArray()) {
    const elementType = resolved.getArrayElementType();
    if (!elementType) {
      return undefined;
    }
    const items = typeToInputSchema(elementType, {
      allowUndefinedUnion: true,
    });
    if (!items) {
      return undefined;
    }
    return { items, type: 'array' };
  }
  if (!resolved.isObject()) {
    return undefined;
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const property of resolved.getProperties()) {
    const name = property.getName();
    if (name.startsWith('__')) {
      continue;
    }
    const declaration = property.getValueDeclaration();
    if (!declaration) {
      return undefined;
    }
    const propertyType = property.getTypeAtLocation(declaration);
    const propertySchema = typeToInputSchema(propertyType, {
      allowUndefinedUnion: true,
    });
    if (!propertySchema) {
      return undefined;
    }
    properties[name] = propertySchema;
    const optional =
      Node.isPropertySignature(declaration) && declaration.hasQuestionToken();
    if (!optional) {
      required.push(name);
    }
  }

  return {
    properties,
    required,
    type: 'object',
  };
};

const contractFromSourceFile = (
  sourceFile: SourceFile,
  slug: string
): FunctionContract | null => {
  const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
  if (!defaultExportSymbol) {
    return null;
  }

  let callable: FunctionLikeDeclaration | undefined;
  let jsDocDescription: string | undefined;
  for (const declaration of defaultExportSymbol.getDeclarations()) {
    jsDocDescription ??= jsDocDescriptionFromDeclaration(declaration);
    callable ??= resolveCallable(declaration);
  }
  if (!callable) {
    return null;
  }

  const description = firstParagraph(jsDocDescription, slug);
  const contract: FunctionContract = { description };

  const inputType = inputParameterType(callable);
  if (inputType) {
    const inputSchema = typeToInputSchema(inputType);
    if (inputSchema) {
      contract.inputSchema = inputSchema;
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
