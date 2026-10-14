// CloudFront 설정 스냅샷을 만들고 비교하는 순수 로직(scripts/check-cloudfront-drift.js가 쓴다).
// AWS 호출과 분리해 마스킹·정렬·비교 규칙만 단위 테스트로 고정한다(src/test/scripts/cloudfront-snapshot.test.ts).

/** 커밋되는 스냅샷 파일(레포 루트 기준) */
export const SNAPSHOT_PATH = 'infra/cloudfront/snapshot.json';

/** CloudFront Function 이름에서 이 접두사를 떼면 infra/cloudfront-functions/<나머지>.js가 소스다 */
export const FUNCTION_NAME_PREFIX = 'link-sphere-';

/**
 * 오리진 도메인(`<버킷>.s3.<리전>.amazonaws.com`)에서 S3 버킷 이름을 뽑는다.
 * 버킷 이름은 레포에 두지 않는 값이라(GitHub 시크릿 S3_BUCKET_NAME) 마스킹에 쓴다.
 *
 * @param {{ Origins?: { Items?: { DomainName: string }[] } }} distributionConfig
 * @returns {string[]}
 */
export function findS3BucketNames(distributionConfig) {
  return (distributionConfig.Origins?.Items ?? [])
    .map(({ DomainName }) => DomainName.match(/^(.+)\.s3[.-]/)?.[1])
    .filter(Boolean);
}

/**
 * 레포에 남기지 않을 값을 자리표시자로 바꾼다 - 버킷 이름·배포 ID는 넘겨받은 값 그대로, 계정 ID·Lambda
 * Function URL·인증서·WAF 식별자는 모양으로 찾는다. 바뀌어도 차이 검사에 안 잡히는 대신 레포에 노출되지 않는다.
 *
 * @template T
 * @param {T} value
 * @param {{ bucketNames?: string[], distributionId?: string }} [secrets]
 * @returns {T}
 */
export function maskSensitive(value, { bucketNames = [], distributionId } = {}) {
  let text = JSON.stringify(value);

  for (const name of bucketNames) {
    text = text.split(name).join('<BUCKET>');
  }

  if (distributionId) {
    text = text.split(distributionId).join('<DISTRIBUTION_ID>');
  }

  // UUID 식별자를 계정 ID보다 먼저 가린다 - UUID 끝 12자리가 숫자뿐이면 계정 ID 패턴이 먼저 먹어 앞부분이 남는다
  text = text
    .replace(/certificate\/[0-9a-f-]{36}/g, 'certificate/<CERTIFICATE_ID>')
    .replace(/(webacl\/[^/"]+)\/[0-9a-f-]{36}/g, '$1/<WEB_ACL_ID>')
    .replace(/[a-z0-9]{32}(?=\.lambda-url\.)/g, '<FUNCTION_URL_ID>')
    .replace(/\b\d{12}\b/g, '<ACCOUNT_ID>');

  return JSON.parse(text);
}

/**
 * 배포 설정에서 비교에 쓸모없거나 매번 달라 보일 수 있는 값을 고정한다 - CallerReference(만들 때 정한
 * 임의 값)와 OAC ID는 자리표시자로, Function 연결은 이벤트 이름 순으로 정렬한다(API가 순서를 보장하지 않는다).
 *
 * @param {Record<string, any>} distributionConfig get-distribution-config의 DistributionConfig
 * @returns {Record<string, any>}
 */
export function normalizeDistributionConfig(distributionConfig) {
  const config = structuredClone(distributionConfig);
  config.CallerReference = '<CALLER_REFERENCE>';

  for (const origin of config.Origins?.Items ?? []) {
    if (origin.OriginAccessControlId) {
      origin.OriginAccessControlId = '<OAC_ID>';
    }
  }

  for (const behavior of [config.DefaultCacheBehavior, ...(config.CacheBehaviors?.Items ?? [])]) {
    behavior?.FunctionAssociations?.Items?.sort((a, b) => a.EventType.localeCompare(b.EventType));
  }

  return config;
}

/**
 * WAF Web ACL에서 규칙과 기본 동작만 남긴다 - Id·ARN·LockToken·LabelNamespace는 식별자라 뺀다.
 *
 * @param {Record<string, any>} webAcl get-web-acl의 WebACL
 * @returns {{ Name: string, DefaultAction: unknown, Rules: unknown[] }}
 */
export function summarizeWebAcl(webAcl) {
  return { Name: webAcl.Name, DefaultAction: webAcl.DefaultAction, Rules: webAcl.Rules };
}

/**
 * 조회한 값을 모아 커밋할 모양(마스킹 포함)으로 만든다.
 *
 * @param {{
 *   distributionId: string,
 *   distributionConfig: Record<string, any>,
 *   cachePolicies: Record<string, unknown>,
 *   originRequestPolicies: Record<string, unknown>,
 *   functions: { Name: string, EventType: string, Runtime: string, Comment: string, RepoFile: string | null, CodeMatchesRepo: boolean }[],
 *   webAcl: Record<string, any> | null,
 * }} input
 */
export function buildSnapshot({
  distributionId,
  distributionConfig,
  cachePolicies,
  originRequestPolicies,
  functions,
  webAcl,
}) {
  const snapshot = {
    distribution: normalizeDistributionConfig(distributionConfig),
    cachePolicies,
    originRequestPolicies,
    functions: [...functions].sort((a, b) => a.EventType.localeCompare(b.EventType)),
    webAcl: webAcl ? summarizeWebAcl(webAcl) : null,
  };

  return maskSensitive(snapshot, {
    bucketNames: findS3BucketNames(distributionConfig),
    distributionId,
  });
}

/**
 * 두 스냅샷의 차이를 `경로: 예전 → 지금` 목록으로 돌려준다(같으면 빈 배열).
 *
 * @param {unknown} expected 커밋된 스냅샷
 * @param {unknown} actual 지금 조회한 스냅샷
 * @param {string} [path]
 * @returns {string[]}
 */
export function diffSnapshots(expected, actual, path = '') {
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    return Array.from({ length }, (_, index) =>
      diffSnapshots(expected[index], actual[index], `${path}[${index}]`)
    ).flat();
  }

  if (isObject(expected) && isObject(actual)) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    return keys.flatMap((key) =>
      diffSnapshots(expected[key], actual[key], path ? `${path}.${key}` : key)
    );
  }

  if (JSON.stringify(expected) === JSON.stringify(actual)) {
    return [];
  }

  const show = (value) => (value === undefined ? '(없음)' : JSON.stringify(value));
  return [`${path || '(전체)'}: ${show(expected)} → ${show(actual)}`];
}
