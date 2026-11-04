// e2e 전용 포트 대역에서 빈 포트를 고른다(scripts/pick-e2e-port.js가 쓴다).
// 스크립트 실행과 분리해 두어 판정 규칙을 단위 테스트로 고정한다(src/test/scripts/e2e-port.test.ts).
import { createServer } from 'net';

// 호스트 없이(모든 주소) 묶어 보는 것만으로는 부족하다. e2e vite는 host를 주지 않아 localhost에만 묶이는데
// (vite 6.4.1 resolveHostname, macOS는 ::1), 모든 주소로는 그 포트에 또 묶여 "비었다"고 나와 다른 세션의
// 서버를 Playwright가 재사용했다. 그래서 루프백 주소마다 따로 본다(2026-11-04 재현,
// docs/TESTING.md "빈 포트를 루프백 주소마다 따로 보는 이유").
const HOSTS = [undefined, '127.0.0.1', '::1'];

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (error) => {
      // IPv6가 없는 환경에서는 ::1에 묶을 주소가 없다 - 사용 중이라는 뜻은 아니다
      resolve(error.code === 'EADDRNOTAVAIL' || error.code === 'EAFNOSUPPORT');
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export async function isPortFree(port) {
  for (const host of HOSTS) {
    if (!(await canListen(port, host))) {
      return false;
    }
  }

  return true;
}

export async function pickFreePort(start, end) {
  for (let port = start; port <= end; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }

  throw new Error(`e2e 전용 포트 대역(${start}-${end})에 빈 포트가 없습니다.`);
}
