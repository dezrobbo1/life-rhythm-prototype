// @vitest-environment jsdom
// Real SDK and production session/boundary adapters; only provider/API HTTP is synthetic.
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import { SupabaseSessionProvider, useSessionAuth } from './SupabaseSessionProvider';
import { AccountBoundaryProvider } from './AccountBoundaryProvider';
import { useState } from 'react';
const subject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function Consumer() {
  const auth = useSessionAuth();
  const [finished, setFinished] = useState(false);
  return <>
    <button onClick={async () => { await auth.signIn('synthetic@example.test', 'synthetic-password'); setFinished(true); }}>Synthetic login</button>
    {finished && <p>Login completed</p>}
    <p data-testid="signed-in">{auth.identity ? 'Signed in' : 'Signed out'}</p>
    <AccountBoundaryProvider><p>Ordinary app</p></AccountBoundaryProvider>
  </>;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each([
  ['normal documented claims', {}, true],
  ['subject mismatch', { sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, false],
  ['missing session id', { session_id: undefined }, false],
  ['invalid session id', { session_id: 'invalid' }, false],
  ['expired token', { exp: 1 }, false],
])('actual SDK to boundary path: %s', async (_name, overrides, accepted) => {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: 'https://synthetic.supabase.co/auth/v1', sub: subject,
    aud: 'authenticated', role: 'authenticated', aal: 'aal1', is_anonymous: false,
    session_id: '11111111-1111-4111-8111-111111111111', iat: now, exp: now + 3600, ...overrides };
  const bearer = 'e30.' + btoa(JSON.stringify(claims)) + '.synthetic';
  const requests: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); requests.push({ url, init });
    if (url.includes('/token')) return Response.json({ access_token: bearer, refresh_token: 'synthetic-refresh',
      token_type: 'bearer', expires_in: 3600, user: { id: subject, email: 'synthetic@example.test' } });
    if (url.startsWith('/api/account/boundary?')) return Response.json({ kind: 'ready', protocolVersion: 1, schemaVersion: 1, buildId: 'synthetic', head: null });
    throw new Error('Unexpected synthetic request');
  }));
  render(<SupabaseSessionProvider url="https://synthetic.supabase.co" publishableKey="sb_publishable_synthetic"><Consumer /></SupabaseSessionProvider>);
  fireEvent.click(screen.getByText('Synthetic login'));
  await screen.findByText('Login completed');
  if (accepted) {
    await screen.findByText('Ordinary app');
    const boundary = requests.filter(r => r.url.startsWith('/api/'));
    expect(boundary).toHaveLength(1);
    expect(boundary[0].url).toBe('/api/account/boundary?protocolVersion=1&schemaVersion=1');
    expect(boundary[0].init?.headers).toEqual({ Authorization: 'Bearer ' + bearer });
    expect(boundary[0].init?.body).toBeUndefined();
    expect(screen.getByTestId('signed-in').textContent).toBe('Signed in');
  } else {
    await waitFor(() => expect(requests.some(r => r.url.includes('/token'))).toBe(true));
    expect(screen.getByTestId('signed-in').textContent).toBe('Signed out');
    expect(requests.filter(r => r.url.startsWith('/api/'))).toHaveLength(0);
    expect(screen.queryByText('Ordinary app')).toBeNull();
  }
});
