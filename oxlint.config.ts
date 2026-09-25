import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import react from 'ultracite/oxlint/react';
import tanstack from 'ultracite/oxlint/tanstack';

/** git-cliff output; not hand-maintained source */
const generatedChangelog = 'CHANGELOG.md';

export default defineConfig({
  extends: [core, react, tanstack],
  ignorePatterns: [...core.ignorePatterns, generatedChangelog],
});
