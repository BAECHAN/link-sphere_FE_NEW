// fetch-openapi.js(로컬/사람이 실행)와 check-openapi-drift.js(cron)가 같은 정규화 규칙을
// 공유한다. 두 스크립트가 각자 이 로직을 베껴 쓰면 조금이라도 어긋나는 순간 드리프트
// 감지 자체가 오탐/누락된다 — "정규화가 일치하는가"가 이 도입 전체의 전제이므로 한 곳에
// 모은다.

/** 객체 키를 재귀적으로 정렬해 출처(local/prod/cron)와 무관하게 동일 바이트가 나오게 한다. */
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

/**
 * springdoc이 요청받은 오리진을 그대로 채워 넣는 servers 필드를 지우고 키를 정렬한다.
 * servers를 남기면 로컬/운영/CloudFront 중 어디서 가져왔는지에 따라 매번 다른 바이트가
 * 나와, 커밋된 스냅샷과 비교하는 드리프트 검사가 출처 차이로 오탐한다.
 */
export function normalizeOpenApiSpec(spec) {
  const rest = { ...spec };

  delete rest.servers;

  return sortKeysDeep(rest);
}
