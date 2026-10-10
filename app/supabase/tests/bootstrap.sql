-- Isolated local PostgreSQL only: emulate verified Data API transaction claims.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema auth to authenticated;
grant execute on function auth.jwt() to authenticated;
set life_rhythm.auth_issuer = 'https://synthetic.supabase.co/auth/v1';
