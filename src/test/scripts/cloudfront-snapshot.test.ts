import { describe, expect, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 스냅샷 규칙을 여기서 검증한다(선례: prune-assets.test.ts)
/* eslint-disable custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다 */
import {
  buildSnapshot,
  diffSnapshots,
  findS3BucketNames,
  normalizeDistributionConfig,
} from '../../../scripts/lib/cloudfront-snapshot.js';
/* eslint-enable custom-import/no-relative-import-except-styles */

// 실제 값이 아닌 가짜 값 - 모양만 실제 응답과 같다
const BUCKET = 'fake-bucket-name';
const ACCOUNT = '111122223333';
const DISTRIBUTION_ID = 'EFAKEDISTRIBUTION';
const FUNCTION_URL_ID = 'abcdefghijklmnopqrstuvwxyz012345';
const CERTIFICATE_ID = '11111111-2222-3333-4444-555555555555';
const WEB_ACL_ID = '66666666-7777-8888-9999-000000000000';

function fakeDistributionConfig() {
  return {
    CallerReference: 'fake-caller-reference',
    Comment: `배포 ${DISTRIBUTION_ID}`,
    Origins: {
      Quantity: 2,
      Items: [
        {
          Id: 'link-sphere-be',
          DomainName: `${FUNCTION_URL_ID}.lambda-url.ap-northeast-1.on.aws`,
          OriginAccessControlId: 'EFAKEOAC1',
        },
        {
          Id: `${BUCKET}.s3.ap-northeast-2.amazonaws.com-abc`,
          DomainName: `${BUCKET}.s3.ap-northeast-2.amazonaws.com`,
          OriginAccessControlId: 'EFAKEOAC2',
        },
      ],
    },
    DefaultCacheBehavior: {
      TargetOriginId: `${BUCKET}.s3.ap-northeast-2.amazonaws.com-abc`,
      FunctionAssociations: {
        Quantity: 2,
        Items: [
          {
            FunctionARN: `arn:aws:cloudfront::${ACCOUNT}:function/link-sphere-spa-status`,
            EventType: 'viewer-response',
          },
          {
            FunctionARN: `arn:aws:cloudfront::${ACCOUNT}:function/link-sphere-spa-fallback`,
            EventType: 'viewer-request',
          },
        ],
      },
    },
    CacheBehaviors: { Quantity: 0 },
    ViewerCertificate: {
      ACMCertificateArn: `arn:aws:acm:us-east-1:${ACCOUNT}:certificate/${CERTIFICATE_ID}`,
    },
    WebACLId: `arn:aws:wafv2:us-east-1:${ACCOUNT}:global/webacl/CreatedByCloudFront-x/${WEB_ACL_ID}`,
  };
}

function fakeSnapshot() {
  return buildSnapshot({
    distributionId: DISTRIBUTION_ID,
    distributionConfig: fakeDistributionConfig(),
    cachePolicies: {},
    originRequestPolicies: {},
    functions: [],
    webAcl: { Name: 'CreatedByCloudFront-x', Id: WEB_ACL_ID, DefaultAction: {}, Rules: [] },
  });
}

describe('buildSnapshot', () => {
  it('버킷·계정 ID·배포 ID·Lambda URL·인증서·WAF·OAC 식별자를 하나도 남기지 않는다', () => {
    const text = JSON.stringify(fakeSnapshot());

    for (const secret of [
      BUCKET,
      ACCOUNT,
      DISTRIBUTION_ID,
      FUNCTION_URL_ID,
      CERTIFICATE_ID,
      WEB_ACL_ID,
      'EFAKEOAC1',
      'fake-caller-reference',
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it('가린 자리는 자리표시자로 남아 구조는 그대로 비교할 수 있다', () => {
    const { distribution } = fakeSnapshot() as {
      distribution: ReturnType<typeof fakeDistributionConfig>;
    };

    expect(distribution.DefaultCacheBehavior.TargetOriginId).toBe(
      '<BUCKET>.s3.ap-northeast-2.amazonaws.com-abc'
    );
    expect(distribution.ViewerCertificate.ACMCertificateArn).toBe(
      'arn:aws:acm:us-east-1:<ACCOUNT_ID>:certificate/<CERTIFICATE_ID>'
    );
  });
});

describe('normalizeDistributionConfig', () => {
  it('Function 연결을 이벤트 이름 순으로 정렬한다 - API가 순서를 보장하지 않는다', () => {
    const config = normalizeDistributionConfig(fakeDistributionConfig()) as ReturnType<
      typeof fakeDistributionConfig
    >;

    expect(config.DefaultCacheBehavior.FunctionAssociations.Items.map((i) => i.EventType)).toEqual([
      'viewer-request',
      'viewer-response',
    ]);
  });
});

describe('findS3BucketNames', () => {
  it('S3 오리진의 버킷 이름만 뽑는다', () => {
    expect(findS3BucketNames(fakeDistributionConfig())).toEqual([BUCKET]);
  });
});

describe('diffSnapshots', () => {
  it('같으면 빈 배열', () => {
    expect(diffSnapshots(fakeSnapshot(), fakeSnapshot())).toEqual([]);
  });

  it('바뀐 값·생긴 키·없어진 배열 항목을 경로로 짚는다', () => {
    const expected = { a: { b: 1 }, list: [1, 2] };
    const actual = { a: { b: 2, c: true }, list: [1] };

    expect(diffSnapshots(expected, actual)).toEqual([
      'a.b: 1 → 2',
      'a.c: (없음) → true',
      'list[1]: 2 → (없음)',
    ]);
  });
});
