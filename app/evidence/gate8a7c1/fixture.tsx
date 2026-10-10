import ReactDOM from 'react-dom/client';
import { AuthBoundary } from '../../src/auth/AuthShell';
import { TaskPoolCaptureModal } from '../../src/features/taskPool/TaskPoolCaptureModal';
import { refreshFixtureAuth, setFixtureAuth } from './supabase-fixture';
import '../../src/styles/tokens.css';
import '../../src/styles/themes.css';
import '../../src/styles/global.css';
import '../../src/styles/foundation.css';
import '../../src/styles/personal-trial.css';
const mode = new URLSearchParams(location.search).get('mode');
(
  window as unknown as { setFixtureAuth: typeof setFixtureAuth }
).setFixtureAuth = setFixtureAuth;
(
  window as unknown as { refreshFixtureAuth: typeof refreshFixtureAuth }
).refreshFixtureAuth = refreshFixtureAuth;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthBoundary
    config={
      mode === 'missing'
        ? {
            mode: 'required',
            authRequested: true,
            publishableKey: null,
            supabaseUrl: null,
            status: 'missing-key',
          }
        : {
            mode: 'required',
            authRequested: true,
            publishableKey: 'sb_publishable_synthetic',
            supabaseUrl: 'https://synthetic.supabase.co',
            status: 'enabled',
          }
    }
  >
    <main data-testid="ordinary">
      <h1>Ordinary synthetic app</h1>
      <button>Local action</button>
      {mode === 'capture' && (
        <TaskPoolCaptureModal
          open
          onClose={() => {}}
          onSave={() => ({ ok: false, errors: [] })}
        />
      )}
    </main>
  </AuthBoundary>,
);
