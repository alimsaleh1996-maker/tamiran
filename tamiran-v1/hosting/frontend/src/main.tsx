import * as React from 'react';
import { createRoot } from 'react-dom/client';
import Home from './app/tamiran/page';
import { installClientDiagnostics } from './app/shared/client-diagnostics';
import { DiagnosticBoundary } from './app/shared/diagnostic-boundary';

// PHP owns login, tenant selection, CSRF and HttpOnly cookies. The browser
// application needs no Node server, Sites dispatcher or ChatGPT account.
installClientDiagnostics();
createRoot(document.getElementById('root')!).render(<DiagnosticBoundary><Home /></DiagnosticBoundary>);
