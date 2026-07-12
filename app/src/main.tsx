import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthBoundary } from './auth/AuthShell';
import './styles/tokens.css';
import './styles/themes.css';
import './styles/global.css';
import './styles/personal-trial.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthBoundary>
      <App />
    </AuthBoundary>
  </React.StrictMode>,
);
