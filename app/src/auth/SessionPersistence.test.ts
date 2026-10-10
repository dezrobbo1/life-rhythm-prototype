// @vitest-environment jsdom
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
it('actual SDK password session never reads/writes browser credential storage', async () => {
  const read = vi.spyOn(Storage.prototype, 'getItem'),
    write = vi.spyOn(Storage.prototype, 'setItem');
  const now = Math.floor(Date.now() / 1000);
  const bearer =
    'e30.' +
    btoa(
      JSON.stringify({
        sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        session_id: '11111111-1111-4111-8111-111111111111',
        exp: now + 60,
      }),
    ) +
    '.synthetic';
  const client = createClient(
    'https://synthetic.supabase.co',
    'sb_publishable_synthetic',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async () =>
          new Response(
            JSON.stringify({
              access_token: bearer,
              token_type: 'bearer',
              expires_in: 60,
              refresh_token: 'synthetic-refresh',
              user: {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                aud: 'authenticated',
                role: 'authenticated',
                email: 'synthetic@example.test',
                app_metadata: {},
                user_metadata: {},
                created_at: new Date().toISOString(),
              },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
      },
    },
  );
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: 'synthetic@example.test',
      password: 'synthetic-password',
    });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBe(bearer);
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    await client.auth.signOut({ scope: 'local' });
    expect((await client.auth.getSession()).data.session).toBeNull();
    expect(write).not.toHaveBeenCalled();
  } finally {
    client.auth.stopAutoRefresh();
    vi.restoreAllMocks();
  }
});
