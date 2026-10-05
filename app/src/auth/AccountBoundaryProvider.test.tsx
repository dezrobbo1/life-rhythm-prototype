// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountBoundaryGate } from './AccountBoundaryProvider';
const ready = {
  kind: 'ready',
  protocolVersion: 1,
  schemaVersion: 1,
  buildId: 'fixture',
  head: null,
};
const getToken = async () => 'synthetic.session.token';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
describe('required account gate', () => {
  it.each([401, 403, 426, 503, 409])(
    'never mounts ordinary content after %s',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          response(
            {
              kind: 'error',
              category:
                status === 401
                  ? 'unauthorized'
                  : status === 403
                    ? 'forbidden'
                    : status === 426
                      ? 'upgrade-required'
                      : status === 409
                        ? 'conflict'
                        : 'unavailable',
              requestId: '11111111-1111-4111-8111-111111111111',
            },
            status,
          ),
        ),
      );
      render(
        <AccountBoundaryGate accountId="A" sessionId="A" getToken={getToken}>
          <p>Ordinary app</p>
        </AccountBoundaryGate>,
      );
      await screen.findByRole('alert');
      expect(screen.queryByText('Ordinary app')).toBeNull();
    },
  );
  it('mounts healthy device-only content and sends no profile/body', async () => {
    const f = vi.fn(async () => response(ready));
    vi.stubGlobal('fetch', f);
    render(
      <AccountBoundaryGate accountId="A" sessionId="A" getToken={getToken}>
        <p>Ordinary app</p>
      </AccountBoundaryGate>,
    );
    await screen.findByText('Ordinary app');
    expect(screen.getByText(/Device-only/)).toBeTruthy();
    expect(f.mock.calls[0]).toEqual([
      '/api/account/boundary?protocolVersion=1&schemaVersion=1',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer synthetic.session.token' },
        cache: 'no-store',
        credentials: 'omit',
      }),
    ]);
    expect(JSON.stringify(f.mock.calls)).not.toContain('profile');
  });
  it('hides successful A synchronously and ignores late A responses after switching to B', async () => {
    let resolve!: (r: Response) => void;
    let count = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        ++count === 1
          ? new Promise<Response>((r) => {
              resolve = r;
            })
          : Promise.resolve(
              response(
                {
                  kind: 'error',
                  category: 'forbidden',
                  requestId: '11111111-1111-4111-8111-111111111111',
                },
                403,
              ),
            ),
      ),
    );
    const { rerender } = render(
      <AccountBoundaryGate accountId="A" sessionId="A" getToken={getToken}>
        <p>Ordinary app</p>
      </AccountBoundaryGate>,
    );
    await waitFor(() => expect(count).toBe(1));
    rerender(
      <AccountBoundaryGate accountId="B" sessionId="B" getToken={getToken}>
        <p>Ordinary app</p>
      </AccountBoundaryGate>,
    );
    resolve(response(ready));
    await screen.findByRole('alert');
    expect(screen.queryByText('Ordinary app')).toBeNull();
  });
  it('clears ready state on same-account session change', async () => {
    let count = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (++count === 1 ? response(ready) : response({}, 503))),
    );
    const { rerender } = render(
      <AccountBoundaryGate accountId="A" sessionId="A1" getToken={getToken}>
        <p>Ordinary app</p>
      </AccountBoundaryGate>,
    );
    await screen.findByText('Ordinary app');
    rerender(
      <AccountBoundaryGate accountId="A" sessionId="A2" getToken={getToken}>
        <p>Ordinary app</p>
      </AccountBoundaryGate>,
    );
    expect(screen.queryByText('Ordinary app')).toBeNull();
    await screen.findByRole('alert');
  });
  it.each([
    {},
    { ...ready, protocolVersion: 2 },
    { ...ready, profile: {} },
    'x'.repeat(20000),
  ])('blocks malformed or oversized response', async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(body)),
    );
    render(
      <AccountBoundaryGate accountId="A" sessionId="A" getToken={getToken}>
        <p>Ordinary app</p>
      </AccountBoundaryGate>,
    );
    await screen.findByRole('alert');
    expect(screen.queryByText('Ordinary app')).toBeNull();
  });
  it('blocks token failure and retries explicitly', async () => {
    const token = vi
      .fn()
      .mockRejectedValueOnce(new Error('private token error'))
      .mockResolvedValue('synthetic.session.token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(ready)),
    );
    render(
      <AccountBoundaryGate accountId="A" sessionId="A" getToken={token}>
        <p>Ordinary app</p>
      </AccountBoundaryGate>,
    );
    await screen.findByRole('alert');
    expect(screen.queryByText('private token error')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Ordinary app');
  });
});
