import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

/** git-cliff output; prose wrap rules fight generated markdown */
const generatedChangelog = 'CHANGELOG.md';

export default defineConfig({
  ...ultracite,
  ignorePatterns: [...ultracite.ignorePatterns, generatedChangelog],
  singleQuote: true,
});
