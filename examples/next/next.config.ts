import type { NextConfig } from 'next';

// @link-sphere/ui는 링크가 아니라 복사본(package.json의 dependenciesMeta injected)으로 node_modules 안에 깔린다. Next는
// node_modules 안의 TS 소스를 변환하지 않아 여기 적는다
// (https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages "When you need it")
const nextConfig: NextConfig = {
  transpilePackages: ['@link-sphere/ui'],
};

export default nextConfig;
