#!/usr/bin/env bun

import { parseFlag, parseJsonInput } from './argv';
import { runDeploy, runDev } from './deploy';
import { runLogin } from './login';

const usage = `functhis — deploy TypeScript functions

Usage:
  functhis login [--console-url URL] [--web-url URL]
  functhis deploy [--slug NAME] [--web-url URL] [--project-root PATH]
  functhis run|dev [--slug FUNCTION] [--input JSON] [--project-root PATH]
`;

const runLocal = async (rest: string[]): Promise<void> => {
  const inputRaw = parseFlag(rest, '--input');
  const parsedInput = parseJsonInput(inputRaw);
  if (!parsedInput.ok) {
    throw new Error(parsedInput.error);
  }
  await runDev({
    functionSlug: parseFlag(rest, '--slug'),
    input: parsedInput.value,
    projectRoot: parseFlag(rest, '--project-root'),
  });
};

const main = async (): Promise<void> => {
  const command = process.argv.at(2);
  const rest = process.argv.slice(3);

  switch (command) {
    case 'login': {
      await runLogin({
        consoleUrl: parseFlag(rest, '--console-url'),
        webUrl: parseFlag(rest, '--web-url'),
      });
      return;
    }
    case 'deploy': {
      await runDeploy({
        projectRoot: parseFlag(rest, '--project-root'),
        slug: parseFlag(rest, '--slug'),
        webUrl: parseFlag(rest, '--web-url'),
      });
      return;
    }
    case 'run':
    case 'dev': {
      await runLocal(rest);
      return;
    }
    default: {
      console.log(usage);
      process.exit(command ? 1 : 0);
    }
  }
};

try {
  await main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
