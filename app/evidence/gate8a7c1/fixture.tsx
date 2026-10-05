import ReactDOM from 'react-dom/client';
import { AuthBoundary } from '../../src/auth/AuthShell';
import { setFixtureAuth } from './clerk-fixture';
import '../../src/styles/tokens.css';
import '../../src/styles/themes.css';
import '../../src/styles/global.css';
import '../../src/styles/foundation.css';
import '../../src/styles/personal-trial.css';
const mode = new URLSearchParams(location.search).get('mode');
(window as unknown as { setFixtureAuth: typeof setFixtureAuth }).setFixtureAuth = setFixtureAuth;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthBoundary
    config={
      mode === 'missing'
        ? { mode: 'required', authRequested: true, publishableKey: null, status: 'missing-key' }
        : {
            mode: 'required',
            authRequested: true,
            publishableKey: 'pk_test_synthetic',
            status: 'enabled',
          }
    }
  >
    <main data-testid="ordinary">
      <h1>Ordinary synthetic app</h1>
      <button>Local action</button>
    </main>
  </AuthBoundary>,
);
