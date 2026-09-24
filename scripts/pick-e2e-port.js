// e2e 전용 포트(dev-server.config.ts의 E2E_SERVER_PORT_RANGE_*)에서 바인딩 가능한 첫 포트를
// 찾아 stdout에 숫자만 출력한다. package.json의 test:e2e가 `E2E_SERVER_PORT=$(node
// scripts/pick-e2e-port.js)`로 이 값을 환경변수로 만들어 playwright test를 실행한다.
//
// playwright.config.ts 안에서 직접(top-level await로) 포트를 고르지 않는 이유: Playwright는
// fullyParallel 워커마다 config 파일을 각자 다시 평가한다 — 워커 A가 "31120이 비어있다"고
// 확인해 실제 webServer를 그 포트로 띄우는 사이, 뒤이어 자기 config를 평가하는 워커 B는
// 그새 채워진 31120을 보고 31121로 건너뛰어버려, 그 워커의 테스트만 아무도 안 띄운 포트로
// 요청을 보내 전부 실패했다(2026-09-24 CI 실측 — 57건 전부 net::ERR_CONNECTION_REFUSED,
// 로컬 재현: `CI=true pnpm exec playwright test`). 포트 선택을 playwright 프로세스 트리
// 바깥의 별도 스크립트에서 딱 한 번만 하고, 그 결과를 환경변수로 넘기면 모든 워커가 같은
// 값을 상속받는다(Node 자식 프로세스 env 상속은 OS 레벨이라 신뢰할 수 있다).
import { createServer } from 'net';
import { E2E_SERVER_PORT_RANGE_START, E2E_SERVER_PORT_RANGE_END } from '../dev-server.config.ts';

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

async function pickFreePort(start, end) {
  for (let port = start; port <= end; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }

  throw new Error(`e2e 전용 포트 대역(${start}-${end})에 빈 포트가 없습니다.`);
}

const port = await pickFreePort(E2E_SERVER_PORT_RANGE_START, E2E_SERVER_PORT_RANGE_END);
process.stdout.write(String(port));
