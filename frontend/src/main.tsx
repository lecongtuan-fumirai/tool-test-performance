import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Automatically route relative /api calls to VITE_API_URL if configured for separate frontend/backend deployments
const apiBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
if (apiBase) {
  const originalFetch = window.fetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api')) {
      return originalFetch(`${apiBase}${input}`, init);
    }
    return originalFetch(input, init);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
