\set ON_ERROR_STOP on
begin;
do $$ begin
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='life_rhythm' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity) <> 2 then raise exception 'RLS/force matrix'; end if;
 if (select rolbypassrls or rolsuper from pg_roles where rolname='authenticated') then raise exception 'runtime privilege'; end if;
 if has_schema_privilege('anon','life_rhythm','usage') then raise exception 'anon schema grant'; end if;
end $$;
set local role authenticated;
set local request.jwt.claims='{"iss":"https://synthetic.supabase.co/auth/v1","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}';
do $$ declare t text; command text; begin
 if (select count(*) from life_rhythm.trial_access) <> 1 then raise exception 'A access isolation'; end if;
 if (select count(*) from life_rhythm.account_heads) <> 1 then raise exception 'A head isolation'; end if;
 if (select revision::text from life_rhythm.account_heads) <> '9007199254740993' then raise exception 'bigint fidelity'; end if;
 if exists(select 1 from life_rhythm.account_heads where subject='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'cross account'; end if;
 foreach t in array array['trial_access','account_heads'] loop
  if not has_table_privilege('authenticated','life_rhythm.'||t,'SELECT') then raise exception 'SELECT grant'; end if;
  foreach command in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
   if has_table_privilege('authenticated','life_rhythm.'||t,command) then raise exception 'write grant % %',t,command; end if;
  end loop;
  foreach command in array array['update life_rhythm.'||t||' set subject=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''','delete from life_rhythm.'||t,'truncate life_rhythm.'||t] loop
   begin execute command; raise exception 'write unexpectedly allowed'; exception when insufficient_privilege then null; end;
  end loop;
 end loop;
 begin insert into life_rhythm.trial_access values('https://synthetic.supabase.co/auth/v1','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);raise exception 'insert allowed';exception when insufficient_privilege then null;end;
 begin insert into life_rhythm.account_heads(issuer,subject,protocol_version,canonical_schema_version,revision,generation) values('https://synthetic.supabase.co/auth/v1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,1,0,gen_random_uuid());raise exception 'head insert allowed';exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claims='{"iss":"https://synthetic.supabase.co/auth/v1","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}';
do $$ begin
 if (select count(*) from life_rhythm.account_heads) <> 1 or (select revision from life_rhythm.account_heads) <> 42 then raise exception 'B isolation';end if;
end $$;
set local request.jwt.claims='{"iss":"https://synthetic.supabase.co/auth/v1","sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}';
do $$ begin if exists(select 1 from life_rhythm.trial_access) or exists(select 1 from life_rhythm.account_heads) then raise exception 'uninvited';end if;end $$;
set local request.jwt.claims='{"iss":"https://synthetic.supabase.co/auth/v1","sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}';
do $$ begin if (select enabled from life_rhythm.trial_access) is distinct from false or exists(select 1 from life_rhythm.account_heads) then raise exception 'disabled';end if;end $$;
set local request.jwt.claims='{"iss":"https://foreign.test","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}';
do $$ begin if exists(select 1 from life_rhythm.trial_access) or exists(select 1 from life_rhythm.account_heads) then raise exception 'issuer pin';end if;end $$;
set local request.jwt.claims='{}';
do $$ begin if exists(select 1 from life_rhythm.trial_access) or exists(select 1 from life_rhythm.account_heads) then raise exception 'missing claims';end if;end $$;
reset role;
-- Disable access while preserving a still-valid JWT; provider reads must deny the head.
update life_rhythm.trial_access set enabled=false where subject='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
set local request.jwt.claims='{"iss":"https://synthetic.supabase.co/auth/v1","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}';
do $$ begin if exists(select 1 from life_rhythm.account_heads) then raise exception 'disabled copied token';end if;end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from life_rhythm.trial_access;raise exception 'anon access allowed';exception when insufficient_privilege then null;end;
 begin perform * from life_rhythm.account_heads;raise exception 'anon head allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Independently prove RLS denial even if SELECT grants are present for anon.
grant usage on schema life_rhythm,auth to anon;
grant execute on function auth.jwt() to anon;
grant select on all tables in schema life_rhythm to anon;
set local role anon;
do $$ begin if exists(select 1 from life_rhythm.trial_access) or exists(select 1 from life_rhythm.account_heads) then raise exception 'anon RLS';end if;end $$;
reset role;
-- Independently prove writes are blocked by RLS after test-only write grants.
grant insert,update,delete on all tables in schema life_rhythm to authenticated;
set local role authenticated;
do $$ declare t text; affected int; begin
 foreach t in array array['trial_access','account_heads'] loop
  execute 'update life_rhythm.'||t||' set subject=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''' ;get diagnostics affected=row_count;if affected<>0 then raise exception 'RLS update';end if;
  execute 'delete from life_rhythm.'||t;get diagnostics affected=row_count;if affected<>0 then raise exception 'RLS delete';end if;
 end loop;
 begin insert into life_rhythm.trial_access values('https://synthetic.supabase.co/auth/v1','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);raise exception 'RLS insert';exception when insufficient_privilege then null;end;
 begin insert into life_rhythm.account_heads(issuer,subject,protocol_version,canonical_schema_version,revision,generation) values('https://synthetic.supabase.co/auth/v1','cccccccc-cccc-4ccc-8ccc-cccccccccccc',1,1,0,gen_random_uuid());raise exception 'RLS head insert';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: real PostgreSQL normal-role A/B, missing/disabled/foreign claims, independent grants/RLS and writes matrix' as outcome;
