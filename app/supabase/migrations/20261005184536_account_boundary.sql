-- Operator must set life_rhythm.auth_issuer to the authorized Supabase Auth issuer
-- in this SAME connection before applying. No real issuer/trust is configured by this file.
begin;
do $$ begin
 if coalesce(current_setting('life_rhythm.auth_issuer',true),'') !~ '^https://[a-z0-9-]+\.supabase\.co/auth/v1$' then
  raise exception 'Authorized Supabase Auth issuer configuration required before schema apply';
 end if;
end $$;
create schema life_rhythm;
revoke all on schema life_rhythm from public,anon,authenticated;
grant usage on schema life_rhythm to authenticated;
create table life_rhythm.trial_access (
 issuer text not null,
 subject text not null,
 enabled boolean not null default false,
 primary key(issuer,subject)
);
create table life_rhythm.account_heads (
 issuer text not null,
 subject text not null,
 protocol_version integer not null check(protocol_version>0),
 canonical_schema_version integer not null check(canonical_schema_version>0),
 revision bigint not null check(revision>=0),
 generation uuid not null,
 updated_at timestamptz not null default now(),
 primary key(issuer,subject),
 foreign key(issuer,subject) references life_rhythm.trial_access(issuer,subject)
);
alter table life_rhythm.trial_access enable row level security;
alter table life_rhythm.trial_access force row level security;
alter table life_rhythm.account_heads enable row level security;
alter table life_rhythm.account_heads force row level security;
revoke all on all tables in schema life_rhythm from public,anon,authenticated;
revoke all on all sequences in schema life_rhythm from public,anon,authenticated;
revoke execute on all functions in schema life_rhythm from public,anon,authenticated;
alter default privileges in schema life_rhythm revoke all on tables from public,anon,authenticated;
alter default privileges in schema life_rhythm revoke all on sequences from public,anon,authenticated;
alter default privileges in schema life_rhythm revoke execute on functions from public,anon,authenticated;
grant select on life_rhythm.trial_access,life_rhythm.account_heads to authenticated;
-- Compile the operator-supplied issuer as a policy literal. Runtime sessions cannot change it.
do $$ declare trusted_issuer text := current_setting('life_rhythm.auth_issuer'); begin
 execute format('create policy own_access on life_rhythm.trial_access for select to authenticated using
 (issuer = %L and issuer = (select auth.jwt()->>''iss'') and subject = (select auth.jwt()->>''sub''))',trusted_issuer);
 execute format('create policy active_own_head on life_rhythm.account_heads for select to authenticated using
 (issuer = %L and issuer = (select auth.jwt()->>''iss'') and subject = (select auth.jwt()->>''sub'') and
 exists(select 1 from life_rhythm.trial_access a where a.issuer=account_heads.issuer and a.subject=account_heads.subject and a.enabled))',trusted_issuer);
end $$;
commit;
