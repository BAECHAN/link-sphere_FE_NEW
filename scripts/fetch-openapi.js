// BE(springdoc)의 OpenAPI 스펙을 가져와 src/shared/api/generated/openapi.json 으로 저장한다.
// 이 파일은 FE에 커밋되는 "vendored spec" 이다 — CI의 pnpm codegen 은 이 스냅샷만 읽고
// 네트워크를 쓰지 않으므로, BE 배포 타이밍과 무관하게 결정론적으로 동작한다. 운영 스펙과의
// 실제 대조는 이 스크립트가 아니라 openapi-drift-check.yml(cron)이 담당한다.
//
// --from=prod(기본)  : VITE_API_BASE_URL(.env)로 지정된 운영/스테이징 오리진에서 가져온다.
// --from=local       : http://localhost:8080/api 에서 가져온다 (BE bootRun 실행 중이어야 함).
//
// servers 필드를 반드시 지운다 — springdoc이 요청받은 오리진을 그대로 servers[0].url 에
// 채워 넣어서(로컬이면 localhost:8080, 운영이면 Lambda Function URL), 지우지 않으면
// --from=local 과 --from=prod 결과가 매번 다른 바이트가 되어 드리프트 게이트(CI)가
// 출처에 따라 오탐한다. 키 정렬도 같은 이유 — 응답 JSON의 키 순서가 매 요청 보장되지
// 않으므로 정렬해야 재현 가능한 diff가 나온다.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'src/shared/api/generated/openapi.json');

dotenv.config({ path: path.join(ROOT, '.env') });

const fromArg = process.argv.find((arg) => arg.startsWith('--from='));
const from = fromArg ? fromArg.split('=')[1] : 'prod';

function resolveBaseUrl(source) {
  if (source === 'local') {
    return 'http://localhost:8080/api';
  }

  if (source === 'prod') {
    const base = process.env.VITE_API_BASE_URL;

    if (!base) {
      throw new Error('.env 에 VITE_API_BASE_URL 이 없습니다.');
    }

    return base;
  }

  throw new Error(`알 수 없는 --from 값: ${source} (local|prod 만 지원)`);
}

/** 객체 키를 재귀적으로 정렬해 출처(local/prod)와 무관하게 동일 바이트가 나오게 한다. */
function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortKeysDeep(value[key]);
        return sorted;
      }, {});
  }

  return value;
}

async function main() {
  const baseUrl = resolveBaseUrl(from);
  const specUrl = `${baseUrl.replace(/\/$/, '')}/v3/api-docs`;

  console.log(`[fetch-openapi] GET ${specUrl}`);

  const response = await fetch(specUrl);

  if (!response.ok) {
    throw new Error(`스펙 요청 실패: HTTP ${response.status} ${specUrl}`);
  }

  const spec = await response.json();

  // servers 는 요청 오리진에 따라 매번 달라지는 환경 정보라 스냅샷에서 제외한다.
  delete spec.servers;

  const normalized = sortKeysDeep(spec);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(normalized, null, 2)}\n`);

  console.log(`[fetch-openapi] 저장됨: ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(`[fetch-openapi] 실패: ${error.message}`);
  process.exit(1);
});
