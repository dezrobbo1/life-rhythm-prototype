// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskPoolCaptureModal } from '../features/taskPool/TaskPoolCaptureModal';
import { AuthBoundary } from './AuthShell';
import { readAuthConfig } from './authConfig';
import {
  createAuthLocalDataNamespace,
  getCurrentLocalDataNamespace,
  getLegacyLocalDataNamespace,
} from '../data/localDataNamespace';
const state = vi.hoisted(() => ({
  callback: null as null | ((event: string, session: unknown) => void),
  session: null as unknown,
  options: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, _key: string, options: unknown) => {
    state.options(options);
    return {
      auth: {
        onAuthStateChange: (cb: typeof state.callback) => {
          state.callback = cb;
          queueMicrotask(() => cb?.('INITIAL_SESSION', state.session));
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
        signInWithPassword: state.signIn,
        signOut: state.signOut,
        stopAutoRefresh: state.stop,
        startAutoRefresh: vi.fn(),
      },
    };
  },
}));
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function session(id = A, sid = '11111111-1111-4111-8111-111111111111') {
  const payload = btoa(
    JSON.stringify({
      sub: id,
      session_id: sid,
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  );
  return {
    user: { id },
    access_token: `e30.${payload}.synthetic`,
    expires_at: Math.floor(Date.now() / 1000) + 60,
  };
}
const env = {
  VITE_LIFE_RHYTHM_AUTH_ENABLED: 'true',
  VITE_SUPABASE_URL: 'https://synthetic.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic',
};
const enabled = () => readAuthConfig(env);
const ready = {
  kind: 'ready',
  protocolVersion: 1,
  schemaVersion: 1,
  buildId: 'test',
  head: null,
};
const mount = () =>
  render(
    <AuthBoundary config={enabled()}>
      <p>Ordinary app</p>
    </AuthBoundary>,
  );
beforeEach(() => {
  state.session = null;
  state.callback = null;
  state.options.mockClear();
  state.stop.mockClear();
  state.signIn.mockReset();
  state.signOut.mockReset();
  state.signIn.mockImplementation(async () => {
    state.callback?.('SIGNED_IN', session());
    return { error: null };
  });
  state.signOut.mockResolvedValue({ error: null });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(ready), {
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function login() {
  await screen.findByLabelText('Email');
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'owner@example.test' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'synthetic-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}
describe('required Supabase sign-in', () => {
  it('requires flag, project URL and publishable key; invalid fixture remains closed', () => {
    expect(enabled().status).toBe('enabled');
    expect(readAuthConfig({}).status).toBe('missing-key');
    for (const override of [
      { VITE_SUPABASE_URL: 'https://foreign.test' },
      { VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never' },
      { VITE_LIFE_RHYTHM_AUTH_ENABLED: 'false' },
    ])
      expect(readAuthConfig({ ...env, ...override }).status).toBe(
        'missing-key',
      );
    expect(
      readAuthConfig({
        VITE_LIFE_RHYTHM_MODE: 'local-fixture',
        MODE: 'production',
      }).status,
    ).toBe('invalid-mode');
  });
  it('missing configuration never opens ordinary content', () => {
    render(
      <AuthBoundary config={readAuthConfig({})}>
        <p>Ordinary app</p>
      </AuthBoundary>,
    );
    expect(screen.queryByText('Ordinary app')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain(
      'Access is unavailable',
    );
  });
  it('keeps explicit development fixture and legacy namespace', () => {
    render(
      <AuthBoundary
        config={readAuthConfig({
          VITE_LIFE_RHYTHM_MODE: 'local-fixture',
          DEV: true,
        })}
      >
        <p>Ordinary app</p>
      </AuthBoundary>,
    );
    expect(screen.getByText('Ordinary app')).toBeTruthy();
    expect(getCurrentLocalDataNamespace()).toEqual(
      getLegacyLocalDataNamespace(),
    );
  });
  it('shows restricted login and truthful persistence/recovery without signup', async () => {
    mount();
    await screen.findByLabelText('Email');
    expect(screen.getByText(/Reloading requires sign-in/)).toBeTruthy();
    expect(
      screen.getByText(/Password recovery is not configured/),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /sign up|reset password/i }),
    ).toBeNull();
    expect(screen.queryByText('Ordinary app')).toBeNull();
  });
  it('uses memory-only sessions and disables URL credential detection', async () => {
    mount();
    await screen.findByLabelText('Email');
    expect(state.options).toHaveBeenCalledWith({
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  });
  it('signs in only then verifies metadata and selects separate namespace', async () => {
    mount();
    await login();
    await screen.findByText('Ordinary app');
    expect(getCurrentLocalDataNamespace()).toEqual(
      createAuthLocalDataNamespace(
        'https://synthetic.supabase.co/auth/v1|' + A,
      ),
    );
    expect(screen.queryByLabelText('Password')).toBeNull();
  });
  it('sanitizes login failures and clears password', async () => {
    state.signIn.mockResolvedValue({
      error: { message: 'PRIVATE PROVIDER ERROR' },
    });
    mount();
    await login();
    await screen.findByRole('alert');
    expect(screen.queryByText(/PRIVATE PROVIDER ERROR/)).toBeNull();
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe(
      '',
    );
    expect(screen.queryByText('Ordinary app')).toBeNull();
  });
  it('clears content immediately even when sign-out provider fails', async () => {
    state.session = session();
    state.signOut.mockResolvedValue({ error: { message: 'private failure' } });
    mount();
    await screen.findByText('Ordinary app');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.queryByText('Ordinary app')).toBeNull();
    await screen.findByLabelText('Email');
    expect(getCurrentLocalDataNamespace()).toEqual(
      getLegacyLocalDataNamespace(),
    );
  });
  it('late A response cannot authorize B after provider account switch', async () => {
    let resolve!: (v: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => (resolve = r)))
      .mockResolvedValue(new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetcher);
    state.session = session();
    mount();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    act(() =>
      state.callback?.(
        'SIGNED_IN',
        session(B, '22222222-2222-4222-8222-222222222222'),
      ),
    );
    await act(async () => resolve(new Response(JSON.stringify(ready))));
    await screen.findByRole('alert');
    expect(screen.queryByText('Ordinary app')).toBeNull();
  });
  it('rejects corrupted client session before requesting metadata', async () => {
    state.session = { user: { id: A }, access_token: 'broken' };
    mount();
    await screen.findByLabelText('Email');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('closes the app at access-token expiry if no refresh arrives', async () => {
    vi.useFakeTimers();
    state.session = session();
    await act(async () => {
      mount();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Ordinary app')).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(61000));
    expect(screen.queryByText('Ordinary app')).toBeNull();
  });
  it('identical same-session refresh retains account without a redundant request', async () => {
    state.session = session();
    mount();
    await screen.findByText('Ordinary app');
    act(() => state.callback?.('TOKEN_REFRESHED', session()));
    await screen.findByText('Ordinary app');
    expect(getCurrentLocalDataNamespace().source).toBe('auth');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('sign-out during pending login ignores late session result', async () => {
    let finish!: () => void;
    state.signIn.mockImplementation(
      () =>
        new Promise((r) => {
          finish = () => {
            state.callback?.('SIGNED_IN', session());
            r({ error: null });
          };
        }),
    );
    mount();
    await login();
    act(() => state.callback?.('SIGNED_OUT', null));
    await act(async () => finish());
    expect(screen.queryByText('Ordinary app')).toBeNull();
  });
});

describe('same-session capture form preservation', () => {
  it.each(['TOKEN_REFRESHED', 'SIGNED_IN'])(
    'preserves ordinary capture draft on %s',
    async (event) => {
      state.session = session();
      render(
        <AuthBoundary config={enabled()}>
          <TaskPoolCaptureModal
            open
            onClose={() => {}}
            onSave={() => ({ ok: false, errors: [] })}
          />
        </AuthBoundary>,
      );
      const title = await screen.findByLabelText('Task title');
      fireEvent.change(title, { target: { value: 'My unsaved task' } });
      fireEvent.change(screen.getByLabelText('Smallest useful action'), {
        target: { value: 'One private line' },
      });
      const refreshed =
        event === 'TOKEN_REFRESHED'
          ? {
              ...session(),
              access_token: session().access_token + '-refreshed',
            }
          : state.session;
      act(() => state.callback?.(event, refreshed));
      await waitFor(() =>
        expect(
          (screen.getByLabelText('Task title') as HTMLInputElement).value,
        ).toBe('My unsaved task'),
      );
      expect(
        (screen.getByLabelText('Smallest useful action') as HTMLInputElement)
          .value,
      ).toBe('One private line');
      expect(screen.getByRole('dialog')).toBeTruthy();
      if (event === 'TOKEN_REFRESHED') {
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        expect(vi.mocked(fetch).mock.calls[1][1]?.headers).toEqual({
          Authorization:
            'Bearer ' + (refreshed as { access_token: string }).access_token,
        });
      } else expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it('closes preserved content when refreshed metadata denies access', async () => {
    state.session = session();
    mount();
    await screen.findByText('Ordinary app');
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ kind: 'unavailable' }, { status: 403 }),
    );
    act(() =>
      state.callback?.('TOKEN_REFRESHED', {
        ...session(),
        access_token: session().access_token + '-new',
      }),
    );
    await screen.findByRole('alert');
    expect(screen.queryByText('Ordinary app')).toBeNull();
  });
});
