import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const packageRoot = path.join(import.meta.dirname, '..');
const generatedPath = path.join(packageRoot, 'src/isolate-module.generated.ts');

const beforeGenerated = await readFile(generatedPath, 'utf-8');
const rebuild = spawnSync('bun', ['scripts/build.ts'], {
  cwd: packageRoot,
  encoding: 'utf-8',
});
process.stdout.write(rebuild.stdout);
process.stderr.write(rebuild.stderr);
if (rebuild.status !== 0) {
  process.exit(rebuild.status ?? 1);
}
const afterGenerated = await readFile(generatedPath, 'utf-8');
if (beforeGenerated !== afterGenerated) {
  console.error(
    'isolate-module.generated.ts is out of date. Run `bun run build` in packages/runtime and commit the result.'
  );
  process.exit(1);
}
const minimumLineCoverage = 85;
const srcDir = path.join(packageRoot, 'src');
const packageSrcMarker = `packages/${path.basename(packageRoot)}/src/`;

const result = spawnSync('bun', ['test', srcDir, '--coverage'], {
  cwd: packageRoot,
  encoding: 'utf-8',
  maxBuffer: 10 * 1024 * 1024,
});

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const coverageSegments = (row: string): string[] =>
  row
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const combinedOutput = `${result.stdout}\n${result.stderr}`;
const srcRows = combinedOutput.split('\n').filter((line) => {
  const filePath = coverageSegments(line).find((segment) =>
    segment.endsWith('.ts')
  );
  if (!filePath || filePath.includes('.test.')) {
    return false;
  }
  return (
    filePath.startsWith('src/') ||
    filePath.includes(packageSrcMarker) ||
    /(?:^|\s)src\/[a-z][\w.-]*\.ts(?:\s|$)/u.test(line)
  );
});

for (const row of srcRows) {
  const segments = coverageSegments(row);
  const filePath = segments.find((segment) => segment.endsWith('.ts'));
  const lineCoverageText = segments.at(2);
  if (!filePath) {
    continue;
  }
  const lineCoverage = Number(lineCoverageText ?? '0');
  if (lineCoverage < minimumLineCoverage) {
    console.error(
      `${filePath} line coverage ${lineCoverage}% is below ${minimumLineCoverage}%`
    );
    process.exit(1);
  }
}

if (srcRows.length === 0) {
  console.error('No src/ coverage rows found in test output');
  process.exit(1);
}
