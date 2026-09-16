#!/usr/bin/env bun

import { runDeploy, runDev } from './deploy';
import { runLogin } from './login';

const usage = `functhis — deploy TypeScript functions

Usage:
  functhis login [--console-url URL] [--web-url URL]
  functhis deploy [--slug NAME] [--web-url URL] [--project-root PATH]
  functhis dev [--slug FUNCTION] [--project-root PATH]
`;

const parseFlag = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
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
    case 'dev': {
      await runDev({
        functionSlug: parseFlag(rest, '--slug'),
        projectRoot: parseFlag(rest, '--project-root'),
      });
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
