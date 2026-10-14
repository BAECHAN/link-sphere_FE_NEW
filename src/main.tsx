import { App } from '@/app/App';
import { QueryProvider } from '@/app/providers/QueryProvider';
import '@/app/globals.css';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BUILD_INFO } from '@/shared/config/build-info';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { ChunkReloadUtil } from '@/shared/utils/chunk-reload.util';

// Vite 동적 청크·CSS 프리로드 실패 처리 (새 배포 직후, 네트워크 실패 등)
// 이벤트 이름은 vite:preloadError(카멜케이스)다 - 2026-03부터 vite:preload-error로 듣고 있어
// 이 리스너는 한 번도 실행되지 않았다(2026-10-14 발견, https://vite.dev/guide/build#load-error-handling).
// 경로별로 세션당 1회만 새로고침한다 - 판단은 AppErrorFallback과 ChunkReloadUtil로 공유한다.
window.addEventListener('vite:preloadError', () => {
  ChunkReloadUtil.reloadOnce();
});

// F12만 열어도 지금 실행 중인 빌드를 바로 알 수 있게 - 상세 비교는 /version 참고
console.info(`[BUILD] ${BUILD_INFO.sha.slice(0, 7)} (${BUILD_INFO.ref}) — /version`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey={STORAGE_KEYS.THEME}
      >
        <App />
      </ThemeProvider>
    </QueryProvider>
  </StrictMode>
);
