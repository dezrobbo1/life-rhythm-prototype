import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(
    (path) =>
      (path.startsWith('app/') || path.startsWith('.github/workflows/app-')) &&
      !path.endsWith('.md') &&
      !path.startsWith('app/docs/') &&
      !/^app\/evidence\/gate8a7c1\/.*\.json$/.test(path),
  )
  .sort();
const hash = createHash('sha256');
for (const path of paths)
  hash
    .update(path + '\0')
    .update(readFileSync(new URL(path, root)))
    .update('\0');
console.log(
  JSON.stringify(
    {
      algorithm: 'sha256(sorted path + NUL + bytes + NUL)',
      base: 'b58b7442c478770f9c0e1db9b6208c8c8e803e30',
      sourceFileCount: paths.length,
      sourceSha256: hash.digest('hex'),
    },
    null,
    2,
  ),
);
