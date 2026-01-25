import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import compression from 'vite-plugin-compression'; // 추가
import mkcert from 'vite-plugin-mkcert';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  // 현재 모드(mode)에 따라 .env 파일들을 로드
  const env = loadEnv(mode, process.cwd(), '');

  // 환경 변수의 기본값 설정
  const API_URL = env.VITE_API_BASE_URL;

  return {
    plugins: [
      react(), // Gzip 압축 파일(.gz) 생성
      compression({
        algorithm: 'gzip',
        ext: '.gz',
      }),
      mkcert(),
      visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    base: '/',
    build: {
      outDir: 'dist',
      // 최신 브라우저 타겟 설정 (레거시 코드 제거)
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
      // 압축 최적화 (esbuild가 더 빠름)
      minify: 'esbuild',
      cssMinify: true,
      // 소스맵은 프로덕션에서는 비활성화 (보안 및 성능)
      sourcemap: false,
      // 압축된 크기 리포트 비활성화 (빌드 시간 단축)
      reportCompressedSize: false,
      // CSS 코드 분할 활성화
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          // 청크 네이밍 최적화
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name || '')) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            if (/\.(gif|jpe?g|png|svg|webp|avif)$/.test(assetInfo.name || '')) {
              return `assets/images/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          manualChunks: (id) => {
            // node_modules 청크 분리
            if (id.includes('node_modules')) {
              // React 코어
              if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
                return 'react-vendor';
              }
              // React Router
              if (/[\\/]node_modules[\\/]react-router/.test(id)) {
                return 'router-vendor';
              }
              // React Query
              if (/[\\/]node_modules[\\/]@tanstack[\\/]react-query/.test(id)) {
                return 'query-vendor';
              }
              // Form 관련 라이브러리
              if (/[\\/]node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/.test(id)) {
                return 'form-vendor';
              }
              // UI 라이브러리 (Mantine, Styled Components)
              if (/[\\/]node_modules[\\/](@mantine|styled-components|@emotion)[\\/]/.test(id)) {
                return 'ui-vendor';
              }
              // 유틸리티
              if (/[\\/]node_modules[\\/](dayjs|zustand)[\\/]/.test(id)) {
                return 'util-vendor';
              }
              // 나머지 node_modules는 별도 청크로
              return 'vendor';
            }

            // 큰 라이브러리들을 별도 청크로 분리
            if (id.includes('recharts')) {
              return 'chart-vendor';
            }
            if (id.includes('@mantine/charts')) {
              return 'mantine-chart-vendor';
            }
            if (id.includes('@tanstack/react-table')) {
              return 'table-vendor';
            }
            // 내부 모듈도 청크 분리 (선택적)
            // 큰 페이지나 위젯은 별도 청크로 분리 가능
          },
          // 사용하지 않는 export 제거
          exports: 'named',
        },
        treeshake: {
          moduleSideEffects: (id) => {
            // CSS 파일은 side effect가 있음
            if (id.includes('.css')) return true;
            // 나머지는 false
            return false;
          },
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false,
        },
      },
    },
    optimizeDeps: {
      // 개발 모드에서도 최적화
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        '@tanstack/react-table',
        'react-hook-form',
        '@hookform/resolvers',
        'zod',
        'zustand',
        'dayjs',
      ],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      __DEPLOY_ENV__: JSON.stringify(mode),
    },
    server: {
      fs: {
        deny: ['..'],
      },
      port: 51119,
      proxy: {
        '/api': {
          target: API_URL,
          changeOrigin: true,
          credentials: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''), // /api 제거
          cookieDomainRewrite: { '*': '' },
          cookiePathRewrite: { '*': '' },
        },
      },
    },
  };
});
