import { App } from '@/app/App';
import { QueryProvider } from '@/app/providers/QueryProvider';
import '@/app/globals.css';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <App />
      </ThemeProvider>
    </QueryProvider>
  </StrictMode>
);
