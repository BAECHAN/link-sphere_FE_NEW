import { App } from '@/app/App';
import { QueryProvider } from '@/app/providers/QueryProvider';
import '@/app/globals.css';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Vite 동적 청크 로드 실패 처리 (새 배포 후 구 청크 hash 불일치)
// ErrorBoundary가 못 잡는 vendor 청크 실패까지 커버
const CHUNK_RELOAD_KEY = 'chunk-reload-attempted';
window.addEventListener('vite:preload-error', () => {
  const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY);
  if (!alreadyReloaded) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <App />
      </ThemeProvider>
    </QueryProvider>
  </StrictMode>
);
