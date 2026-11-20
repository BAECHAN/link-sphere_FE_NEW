// CloudFront Function 배포 전 시험에 쓰는 순수 로직(scripts/deploy-cloudfront-functions.js가 쓴다).
// 시험 케이스(infra/cloudfront-functions/test-cases.json)를 `aws cloudfront test-function`의 이벤트로 바꾸고,
// 돌려받은 결과가 기대와 같은지 판정한다. 같은 케이스를 src/app/routes/cloudfront-functions.test.ts가 Node에서도
// 돌린다 - 그래서 판정은 test-function의 출력({ request } / { response })과 handler의 반환값을 둘 다 받는다.

/** 시험 케이스 파일(레포 루트 기준). 배열 순서가 곧 게시 순서다 */
export const TEST_CASES_PATH = 'infra/cloudfront-functions/test-cases.json';

function toHeaders(values) {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { value }]));
}

/**
 * 케이스 하나를 CloudFront Functions 이벤트(버전 1.0)로 만든다.
 * 구조: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html
 *
 * @param {'viewer-request' | 'viewer-response'} eventType
 * @param {{ uri: string, acceptEncoding?: string, userAgent?: string, responseHeaders?: Record<string, string> }} testCase
 */
export function buildTestEvent(eventType, testCase) {
  const event = {
    version: '1.0',
    context: { eventType },
    viewer: { ip: '198.51.100.1' },
    request: {
      method: 'GET',
      uri: testCase.uri,
      querystring: {},
      headers: toHeaders({
        ...(testCase.acceptEncoding === undefined
          ? {}
          : { 'accept-encoding': testCase.acceptEncoding }),
        ...(testCase.userAgent === undefined ? {} : { 'user-agent': testCase.userAgent }),
      }),
      cookies: {},
    },
  };

  if (eventType === 'viewer-response') {
    event.response = {
      statusCode: 200,
      statusDescription: 'OK',
      headers: toHeaders(testCase.responseHeaders ?? {}),
      cookies: {},
    };
  }

  return event;
}

/**
 * Function이 돌려준 값이 케이스의 기대와 다른 점을 문장으로 모은다. 빈 배열이면 통과다.
 *
 * @param {{ expect: { uri?: string, statusCode?: number, headers?: Record<string, string>, absentHeaders?: string[] } }} testCase
 * @param {Record<string, any>} output test-function의 FunctionOutput을 파싱한 값, 또는 handler의 반환값
 * @returns {string[]}
 */
export function findMismatches(testCase, output) {
  const result = output.request ?? output.response ?? output;
  const { uri, statusCode, headers = {}, absentHeaders = [] } = testCase.expect;
  const mismatches = [];

  if (uri !== undefined && result.uri !== uri) {
    mismatches.push(`uri: 기대 ${uri}, 실제 ${result.uri}`);
  }

  if (statusCode !== undefined && result.statusCode !== statusCode) {
    mismatches.push(`statusCode: 기대 ${statusCode}, 실제 ${result.statusCode}`);
  }

  for (const [name, value] of Object.entries(headers)) {
    const actual = result.headers?.[name]?.value;

    if (actual !== value) {
      mismatches.push(`헤더 ${name}: 기대 ${value}, 실제 ${actual}`);
    }
  }

  for (const name of absentHeaders) {
    if (result.headers?.[name] !== undefined) {
      mismatches.push(`헤더 ${name}: 없어야 하는데 ${result.headers[name].value}`);
    }
  }

  return mismatches;
}
