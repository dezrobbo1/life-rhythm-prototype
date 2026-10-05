import { createServer } from 'vite';
import { resolve } from 'node:path';
const server = await createServer({
  resolve: { alias: { '@clerk/react': resolve('evidence/gate8a7c1/clerk-fixture.tsx') } },
  server: { host: '127.0.0.1', port: 5179, strictPort: true },
});
await server.listen();
console.log('Synthetic replay server: http://127.0.0.1:5179');
