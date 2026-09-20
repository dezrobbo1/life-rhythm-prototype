// Temporary PR #139 validation driver. Removed after its CI evidence is saved.
// It tests an exact, hash-verified copy of the reviewed tree, not this driver.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';

const expectedTree = '96c7b66be64e93fd995945213ff159e60cea7367';
const driverPath = 'app/pr139-timezone-validation.test.js';

it('validates the exact reviewed PR139 tree in UTC and Australia/Perth', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const temporary = mkdtempSync(join(tmpdir(), 'pr139-timezones-'));
  const git = (args, extra = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...extra }).trim();
  try {
    // A separate index leaves the CI checkout and its normal index untouched.
    const indexEnv = { ...process.env, GIT_INDEX_FILE: join(temporary, 'validation-index') };
    git(['read-tree', 'HEAD'], { env: indexEnv });
    git(['update-index', '--force-remove', driverPath], { env: indexEnv });
    const testedTree = git(['write-tree'], { env: indexEnv });
    assert.equal(testedTree, expectedTree, 'Unexpected source changes: refuse to validate a different tree');
    assert.equal(git(['diff', '--name-only', testedTree, 'HEAD']), driverPath);
    git(['diff', '--check', testedTree, 'HEAD']);

    const checkout = join(temporary, 'reviewed-source');
    mkdirSync(checkout);
    const archive = execFileSync('git', ['archive', '--format=tar', testedTree], {
      cwd: root, maxBuffer: 32 * 1024 * 1024,
    });
    execFileSync('tar', ['-xf', '-', '-C', checkout], { input: archive });
    assert.equal(existsSync(join(checkout, driverPath)), false, 'Driver must not enter the tested source');
    // Reuse only dependencies installed by the unchanged npm ci workflow.
    symlinkSync(join(root, 'app', 'node_modules'), join(checkout, 'app', 'node_modules'), 'dir');

    const results = [];
    console.log(`PR139_EXACT_TESTED_TREE=${testedTree}`);
    for (const timezone of ['UTC', 'Australia/Perth']) {
      const env = { ...process.env, TZ: timezone, NO_COLOR: '1' };
      delete env.FORCE_COLOR;
      const observedTimezone = execFileSync(process.execPath, ['-e',
        'process.stdout.write(Intl.DateTimeFormat().resolvedOptions().timeZone)'], { env, encoding: 'utf8' });
      assert.equal(observedTimezone, timezone);
      const startedAt = new Date().toISOString();
      const run = spawnSync('npm', ['test', '--', '--reporter=verbose'], {
        cwd: join(checkout, 'app'), env, encoding: 'utf8',
        timeout: 240000, maxBuffer: 32 * 1024 * 1024,
      });
      const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`
        .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
      console.log(`PR139_TZ_BEGIN=${timezone}\n${output}\nPR139_TZ_END=${timezone}`);
      assert.ifError(run.error);
      assert.equal(run.status, 0, `${timezone} full suite failed`);
      assert.match(output, /Test Files\s+67 passed\s+\(67\)/);
      assert.match(output, /Tests\s+824 passed\s+\(824\)/);
      results.push({ timezone, observedTimezone, testedTree, startedAt,
        finishedAt: new Date().toISOString(), files: 67, tests: 824, exitCode: run.status });
    }
    console.log(`PR139_TIMEZONE_VALIDATION=${JSON.stringify({ testedTree, results })}`);
  } finally {
    // This is only the newly created validation directory, never user storage.
    rmSync(temporary, { recursive: true, force: true });
  }
}, 600000);
