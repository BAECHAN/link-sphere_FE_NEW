import { createServer, type AddressInfo, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 포트 판정을 여기서 검증한다(선례: prune-assets.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { isPortFree, pickFreePort } from '../../../scripts/lib/e2e-port.js';

const servers: Server[] = [];

function listen(port: number, host?: string) {
  return new Promise<Server>((resolve, reject) => {
    const server = createServer();

    server.once('error', reject);
    server.listen(port, host, () => {
      servers.push(server);
      resolve(server);
    });
  });
}

// OS가 비어 있다고 준 포트를 받는다 - e2e 대역(31120~)을 그대로 쓰면 다른 세션의 실행과 겹친다
async function osFreePort() {
  const server = await listen(0, '127.0.0.1');
  const { port } = server.address() as AddressInfo;

  servers.splice(servers.indexOf(server), 1);
  await new Promise((resolve) => server.close(resolve));

  return port;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))
  );
});

describe('isPortFree', () => {
  it('아무도 쓰지 않는 포트는 비었다고 본다', async () => {
    expect(await isPortFree(await osFreePort())).toBe(true);
  });

  // e2e vite는 host를 주지 않아 localhost(macOS는 ::1)에만 묶인다. 호스트 없이 listen해 보는 검사는 이 서버를
  // 못 봐, 다른 세션이 띄운 서버를 Playwright가 재사용했다(2026-11-04,
  // docs/TESTING.md "빈 포트를 루프백 주소마다 따로 보는 이유")
  it.each(['localhost', '127.0.0.1', '::1'])(
    '다른 서버가 %s에 묶은 포트는 사용 중으로 본다',
    async (host) => {
      const port = await osFreePort();
      await listen(port, host);

      expect(await isPortFree(port)).toBe(false);
    }
  );

  it('다른 서버가 모든 주소에 묶은 포트는 사용 중으로 본다', async () => {
    const port = await osFreePort();
    await listen(port);

    expect(await isPortFree(port)).toBe(false);
  });
});

describe('pickFreePort', () => {
  it('다른 서버가 localhost에 묶은 포트를 고르지 않는다', async () => {
    const port = await osFreePort();
    await listen(port, 'localhost');

    await expect(pickFreePort(port, port)).rejects.toThrow('빈 포트가 없습니다');
  });

  it('대역에서 처음 비어 있는 포트를 고른다', async () => {
    const port = await osFreePort();

    expect(await pickFreePort(port, port)).toBe(port);
  });
});
