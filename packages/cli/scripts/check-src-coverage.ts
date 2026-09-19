import { spawnSync } from 'node:child_process';
import path from 'node:path';

const packageRoot = path.join(import.meta.dirname, '..');
const minimumLineCoverage = 80;

const result = spawnSync('bun', ['test', 'src', '--coverage'], {
  cwd: packageRoot,
  encoding: 'utf-8',
  maxBuffer: 10 * 1024 * 1024,
});

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const combinedOutput = `${result.stdout}\n${result.stderr}`;
const srcRows = combinedOutput
  .split('\n')
  .filter((line) => /\ssrc\/[a-z].+\.ts/u.test(line));

for (const row of srcRows) {
  const segments = row
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  const [filePath, , lineCoverageText] = segments;
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
