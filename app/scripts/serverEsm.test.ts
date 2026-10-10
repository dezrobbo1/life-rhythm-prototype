// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

it('starts the emitted API in native Node ESM and reaches fail-closed HTTP responses', () => {
  const appRoot = fileURLToPath(new URL('../', import.meta.url));
  // Keep normal package/dependency resolution; remove every emitted file afterwards.
  const output = mkdtempSync(join(appRoot, '.c1-native-'));
  try {
    execFileSync(process.execPath, [
      join(appRoot, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.server.json',
      '--noEmit', 'false', '--rootDir', '.', '--outDir', output,
    ], { cwd: appRoot, encoding: 'utf8', timeout: 30000 });
    const entry = pathToFileURL(join(output, 'api/account/boundary.js')).href;
    const result = execFileSync(process.execPath, ['--input-type=module', '--eval', `
      import assert from 'node:assert/strict';
      import { createServer } from 'node:http';
      const { default: handler } = await import(${JSON.stringify(entry)});
      const server = createServer(handler);
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      try {
        const base = 'http://127.0.0.1:' + server.address().port;
        const cases = [
          ['?protocolVersion=1&schemaVersion=1', 'GET', 503, 'unavailable'],
          ['', 'POST', 405, 'method-not-allowed'],
          ['?protocolVersion=1&schemaVersion=1&owner=synthetic', 'GET', 400, 'invalid-request'],
        ];
        for (const [query, method, status, category] of cases) {
          const response = await fetch(base + '/api/account/boundary' + query, { method });
          assert.equal(response.status, status);
          assert.equal(response.headers.get('cache-control'), 'private, no-store');
          assert.equal(response.headers.get('content-type').includes('application/json'), true);
          if (method === 'POST') assert.equal(response.headers.get('allow'), 'GET');
          const body = await response.json();
          assert.equal(body.kind, 'error');
          assert.equal(body.category, category);
          assert.deepEqual(Object.keys(body).sort(), ['category', 'kind', 'requestId']);
          assert.match(body.requestId, /^[0-9a-f-]{36}$/);
        }
        console.log('native-esm-http: 3 cases passed');
      } finally {
        await new Promise(resolve => server.close(resolve));
      }
    `], {
      cwd: appRoot, encoding: 'utf8', timeout: 15000,
      // Do not inherit provider configuration, credentials, Node loaders or runtime flags.
      env: { PATH: process.env.PATH },
    });
    expect(result.trim()).toBe('native-esm-http: 3 cases passed');
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}, 45000);
