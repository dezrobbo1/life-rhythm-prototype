`pr180-production-config.js` is a bounded regression fixture: the exact minified
`readAuthConfig` function extracted by ESTree function boundaries from a local
production build of PR #180 source `5e08c55918eaf64be02d210b17fbcd11c7ec34bf`.
Its only substituted build inputs were synthetic public configuration:
`VITE_SUPABASE_URL=https://lfwadowwdvcnibjkeerg.supabase.co`,
`VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_synthetic`,
`VITE_LIFE_RHYTHM_AUTH_ENABLED=true`, `VITE_LIFE_RHYTHM_MODE=required`.
Node 24.19.0, source app lockfile and Vite 8.0.16; no hosted resource or secret.
It is parsed, never executed. No full bundle, source archive or browser state is
committed. Full locally built HTML/JS extraction was also verified separately;
that build is not hosted deployment attribution.
