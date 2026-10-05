-- Synthetic identities only. Operator load, never runtime enrollment.
insert into life_rhythm.trial_access values
 ('https://synthetic.supabase.co/auth/v1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
 ('https://synthetic.supabase.co/auth/v1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true),
 ('https://synthetic.supabase.co/auth/v1','dddddddd-dddd-4ddd-8ddd-dddddddddddd',false),
 ('https://foreign.test','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
insert into life_rhythm.account_heads(issuer,subject,protocol_version,canonical_schema_version,revision,generation) values
 ('https://synthetic.supabase.co/auth/v1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,1,9007199254740993,'11111111-1111-4111-8111-111111111111'),
 ('https://synthetic.supabase.co/auth/v1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,1,42,'22222222-2222-4222-8222-222222222222'),
 ('https://synthetic.supabase.co/auth/v1','dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,1,3,'33333333-3333-4333-8333-333333333333'),
 ('https://foreign.test','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,1,9,'44444444-4444-4444-8444-444444444444');
