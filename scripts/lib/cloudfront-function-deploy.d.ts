// scripts/는 tsconfig 밖 평문 JS라, src/의 테스트가 import할 때 쓰는 타입 선언(cloudfront-function-deploy.js와 함께 고친다)
export const TEST_CASES_PATH: string;

export type FunctionEventType = 'viewer-request' | 'viewer-response';

export interface FunctionTestCase {
  uri: string;
  acceptEncoding?: string;
  userAgent?: string;
  responseHeaders?: Record<string, string>;
  expect: {
    uri?: string;
    statusCode?: number;
    headers?: Record<string, string>;
    absentHeaders?: string[];
  };
}

export interface FunctionTestSuite {
  file: string;
  eventType: FunctionEventType;
  cases: FunctionTestCase[];
}

export function buildTestEvent(
  eventType: FunctionEventType,
  testCase: Pick<FunctionTestCase, 'uri' | 'acceptEncoding' | 'userAgent' | 'responseHeaders'>
): Record<string, unknown>;

export function findMismatches(
  testCase: Pick<FunctionTestCase, 'expect'>,
  output: Record<string, unknown>
): string[];
