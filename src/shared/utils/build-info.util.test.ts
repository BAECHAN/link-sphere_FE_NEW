import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { BuildInfoUtil } from '@/shared/utils/build-info.util';

const VALID_BUILD_INFO = {
  sha: 'abc1234',
  ref: 'main',
  mode: 'production',
  runNumber: '42',
  runId: '1234567890',
  builtAt: '2026-09-20T06:55:48.340Z',
};

describe('BuildInfoUtil.fetchDeployedBuildInfo', () => {
  it('정상 JSON이면 파싱된 객체를 반환한다', async () => {
    server.use(http.get('*/version.json', () => HttpResponse.json(VALID_BUILD_INFO)));

    await expect(BuildInfoUtil.fetchDeployedBuildInfo()).resolves.toEqual(VALID_BUILD_INFO);
  });

  it('404면 null이다', async () => {
    server.use(http.get('*/version.json', () => new HttpResponse(null, { status: 404 })));

    await expect(BuildInfoUtil.fetchDeployedBuildInfo()).resolves.toBeNull();
  });

  it('sha가 없는 JSON이면 null이다', async () => {
    server.use(
      http.get('*/version.json', () => HttpResponse.json({ builtAt: VALID_BUILD_INFO.builtAt }))
    );

    await expect(BuildInfoUtil.fetchDeployedBuildInfo()).resolves.toBeNull();
  });

  it('sha가 문자열이 아니면 null이다', async () => {
    server.use(
      http.get('*/version.json', () => HttpResponse.json({ ...VALID_BUILD_INFO, sha: 123 }))
    );

    await expect(BuildInfoUtil.fetchDeployedBuildInfo()).resolves.toBeNull();
  });

  it('JSON이 아닌 본문이면 null이다', async () => {
    server.use(
      http.get(
        '*/version.json',
        () => new HttpResponse('not json', { headers: { 'Content-Type': 'text/plain' } })
      )
    );

    await expect(BuildInfoUtil.fetchDeployedBuildInfo()).resolves.toBeNull();
  });

  it('네트워크 에러면 null이다', async () => {
    server.use(http.get('*/version.json', () => HttpResponse.error()));

    await expect(BuildInfoUtil.fetchDeployedBuildInfo()).resolves.toBeNull();
  });
});
