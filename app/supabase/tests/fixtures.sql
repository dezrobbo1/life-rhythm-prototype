-- Synthetic identities only. Operator load, never runtime enrollment.
insert into life_rhythm.trial_access values
 ('https://synthetic.clerk.accounts.dev','user_A',true),
 ('https://synthetic.clerk.accounts.dev','user_B',true),
 ('https://synthetic.clerk.accounts.dev','user_disabled',false),
 ('https://foreign.test','user_A',true);
insert into life_rhythm.account_heads(issuer,subject,protocol_version,canonical_schema_version,revision,generation) values
 ('https://synthetic.clerk.accounts.dev','user_A',1,1,9007199254740993,'11111111-1111-4111-8111-111111111111'),
 ('https://synthetic.clerk.accounts.dev','user_B',1,1,42,'22222222-2222-4222-8222-222222222222'),
 ('https://synthetic.clerk.accounts.dev','user_disabled',1,1,3,'33333333-3333-4333-8333-333333333333'),
 ('https://foreign.test','user_A',1,1,9,'44444444-4444-4444-8444-444444444444');
