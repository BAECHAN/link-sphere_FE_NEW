import { App } from '@/app/App';
import { QueryProvider } from '@/app/providers/QueryProvider';
import '@/app/globals.css';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Vite 동적 청크 로드 실패 처리 (새 배포 후 구 청크 hash 불일치)
// 재시도 키에 현재 pathname을 포함시켜, 다른 페이지 이동 시 재시도를 허용
window.addEventListener('vite:preload-error', () => {
  const reloadKey = `chunk-reload:${location.pathname}`;
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, '1');
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
