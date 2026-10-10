// @vitest-environment jsdom
// Production provider and actual pinned SDK; only HTTP is synthetic.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  SupabaseSessionProvider,
  useSessionAuth,
} from './SupabaseSessionProvider';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function Consumer() {
  const auth = useSessionAuth();
  return (
    <>
      <p data-testid="identity">{auth.identity?.userId ?? 'none'}</p>
      <button onClick={() => void auth.signIn('a@example.test', 'synthetic')}>
        A
      </button>
      <button onClick={() => void auth.signIn('b@example.test', 'synthetic')}>
        B
      </button>
      <button onClick={() => void auth.signOut()}>Out</button>
    </>
  );
}
function sessionBody(id: string) {
  const payload = btoa(
    JSON.stringify({
      sub: id,
      session_id: '11111111-1111-4111-8111-111111111111',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return {
    access_token: `e30.${payload}.synthetic`,
    refresh_token: `synthetic-${id}`,
    token_type: 'bearer',
    expires_in: 3600,
    user: { id, email: `${id}@example.test` },
  };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([204, 500])(
  'coordinates new login with delayed logout HTTP %s using actual SDK',
  async (status) => {
    let release!: (response: Response) => void;
    let logoutStarted = false;
    let bStarted = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/logout')) {
          logoutStarted = true;
          return new Promise<Response>((resolve) => {
            release = resolve;
          });
        }
        if (url.includes('/token')) {
          const submitted = JSON.parse(String(init?.body));
          const id = submitted.email.startsWith('a') ? A : B;
          if (id === B) bStarted = true;
          return Response.json(sessionBody(id));
        }
        throw new Error('Unexpected synthetic request');
      }),
    );
    render(
      <SupabaseSessionProvider
        url="https://synthetic.supabase.co"
        publishableKey="sb_publishable_synthetic"
      >
        <Consumer />
      </SupabaseSessionProvider>,
    );
    fireEvent.click(screen.getByText('A'));
    await waitFor(() =>
      expect(screen.getByTestId('identity').textContent).toBe(A),
    );
    fireEvent.click(screen.getByText('Out'));
    await waitFor(() => expect(logoutStarted).toBe(true));
    expect(screen.getByTestId('identity').textContent).toBe('none');
    fireEvent.click(screen.getByText('B'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(bStarted).toBe(false);
    await act(async () =>
      release(
        status === 204
          ? new Response(null, { status })
          : Response.json({ message: 'synthetic failure' }, { status }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId('identity').textContent).toBe(B),
    );
    expect(bStarted).toBe(true);
  },
);
