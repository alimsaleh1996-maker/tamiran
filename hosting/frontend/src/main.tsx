import * as React from 'react';
import { createRoot } from 'react-dom/client';
import Home from './app/tamiran/page';

// PHP owns login, tenant selection, CSRF and HttpOnly cookies. The browser
// application needs no Node server, Sites dispatcher or ChatGPT account.
createRoot(document.getElementById('root')!).render(<Home />);
