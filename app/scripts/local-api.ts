import { createServer } from 'node:http';
import handler from '../api/account/boundary';
if (process.env.NODE_ENV === 'production')
  throw new Error('Local API bridge is development/test only');
createServer(handler).listen(8787, '127.0.0.1', () =>
  console.log('Local required API: http://127.0.0.1:8787; provider config is still required'),
);
