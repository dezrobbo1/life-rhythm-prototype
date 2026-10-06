// Non-secret loopback admission fixture only; never deployed or used as provider trust.
import { createServer as createViteServer } from 'vite';
import { resolve } from 'node:path';
if (process.env.NODE_ENV === 'production') throw new Error('Test fixture only');
const counts = { deniedBeforeHandler: 0, handlerInvocations: 0, bearerPresent: false };
const server = await createViteServer({
  resolve: { alias: { '@supabase/supabase-js': resolve('evidence/gate8a7c1/supabase-fixture.ts') } },
  server: { host: '127.0.0.1', port: 5192, strictPort: true },
  plugins: [{ name: 'synthetic-cookie-admission', configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
      if (req.url === '/synthetic-counts') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(counts));
        return;
      }
      if (req.url?.startsWith('/api/account/boundary')) {
        if (!req.headers.cookie?.includes('c1_synthetic_admission=nonsecret')) {
          counts.deniedBeforeHandler++;
          res.statusCode = 401;
          res.setHeader('content-type', 'text/html');
          res.end('<h1>Synthetic admission required</h1>');
          return;
        }
        counts.handlerInvocations++;
        counts.bearerPresent = !!req.headers.authorization?.startsWith('Bearer ');
        res.setHeader('content-type', 'application/json');
        res.setHeader('cache-control', 'private, no-store');
        if (!counts.bearerPresent) {
          res.statusCode = 401;
          res.end(JSON.stringify({ kind: 'error', category: 'unauthorized', requestId: '11111111-1111-4111-8111-111111111111' }));
          return;
        }
        res.end(JSON.stringify({ kind: 'ready', protocolVersion: 1, schemaVersion: 1, buildId: 'synthetic-local-admission', head: null }));
        return;
      }
      if (req.url?.includes('fixture.html'))
        res.setHeader('Set-Cookie', 'c1_synthetic_admission=nonsecret; HttpOnly; SameSite=Strict; Path=/');
      next();
    });
  } }],
});
await server.listen();
console.log('Local synthetic admission fixture: http://127.0.0.1:5192');
