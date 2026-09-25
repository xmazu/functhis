#!/usr/bin/env node

import type { VersionBump } from '@functhis/publish/semver';

import {
  parseBooleanFlag,
  parseFlag,
  parseJsonInput,
  parseSecretFlags,
} from './argv';
import { runLogin } from './login';
import { runPublish, runDev, runRollback } from './publish';
import { parsePublishVisibility } from './publish-sharing';

const usage = `functhis - publish TypeScript functions

Usage:
  functhis login [--url URL]
  functhis publish [--slug NAME] [--scope HANDLE] [--major|--minor|--patch] [--visibility private|library] [--url URL] [--project-root PATH]
  functhis rollback VERSION [--slug NAME] [--scope HANDLE] [--url URL] [--project-root PATH]
  functhis run|dev [--slug FUNCTION] [--input JSON] [--secret NAME=value] [--project-root PATH]
`;

const parseBump = (rest: string[]): VersionBump | undefined => {
  const major = parseBooleanFlag(rest, '--major');
  const minor = parseBooleanFlag(rest, '--minor');
  const patch = parseBooleanFlag(rest, '--patch');
  const selected = Number(major) + Number(minor) + Number(patch);
  if (selected > 1) {
    throw new Error('Use only one of --major, --minor, or --patch.');
  }
  if (major) {
    return 'major';
  }
  if (minor) {
    return 'minor';
  }
  if (patch) {
    return 'patch';
  }
  return undefined;
};

const parseAppUrl = (rest: string[]): string | undefined => {
  if (
    parseFlag(rest, '--web-url') !== undefined ||
    parseFlag(rest, '--console-url') !== undefined
  ) {
    throw new Error('Use --url. --web-url and --console-url were removed.');
  }
  return parseFlag(rest, '--url');
};

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
    secrets: parseSecretFlags(rest),
  });
};

const publishOptions = (rest: string[]) => ({
  bump: parseBump(rest),
  organizationSlug: parseFlag(rest, '--organization'),
  projectRoot: parseFlag(rest, '--project-root'),
  scope: parseFlag(rest, '--scope'),
  slug: parseFlag(rest, '--slug'),
  url: parseAppUrl(rest),
  visibility: parsePublishVisibility(parseFlag(rest, '--visibility')),
});

const main = async (): Promise<void> => {
  const command = process.argv.at(2);
  const rest = process.argv.slice(3);

  switch (command) {
    case 'login': {
      await runLogin({
        url: parseAppUrl(rest),
      });
      return;
    }
    case 'publish': {
      await runPublish(publishOptions(rest));
      return;
    }
    case 'rollback': {
      const [semver] = rest;
      if (!semver || semver.startsWith('--')) {
        throw new Error('Usage: functhis rollback <semver>');
      }
      await runRollback({
        projectRoot: parseFlag(rest, '--project-root'),
        scope: parseFlag(rest, '--scope') ?? parseFlag(rest, '--organization'),
        semver,
        slug: parseFlag(rest, '--slug'),
        url: parseAppUrl(rest),
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
