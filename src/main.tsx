import { App } from '@/app/App';
import { QueryProvider } from '@/app/providers/QueryProvider';
import '@/app/globals.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>
);
