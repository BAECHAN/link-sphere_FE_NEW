# 배포 가이드 (Deployment Guide)

이 문서는 Link Sphere Frontend 애플리케이션의 배포 아키텍처와 GitHub Actions를 이용한 자동화 절차에 대해 설명합니다.
이 파이프라인 위에 걸려 있는 PR·배포 검사 게이트(타입체크·린트·테스트)는 [CI-CHECK-GATE.md](./CI-CHECK-GATE.md)를 참고하세요.

## 아키텍처 (Architecture)

본 프로젝트는 AWS S3와 CloudFront를 사용하여 정적 웹 호스팅을 구현하고 있습니다.

- **AWS S3 (Simple Storage Service)**: 빌드된 정적 파일(HTML, CSS, JS, Assets)을 저장하는 원본(Origin) 저장소입니다.
- **AWS CloudFront**: S3에 저장된 정적 파일을 전 세계 엣지 로케이션에서 캐싱하여 빠르게 제공하는 CDN(Content Delivery Network)입니다.

## CI/CD 파이프라인 (GitHub Actions)

이 프로젝트는 `.github/workflows/deploy.yml`에 정의된 워크플로우를 통해 **Main 브랜치에 Push** 될 때 자동으로 배포됩니다.

### 워크플로우 상세 단계

1.  **Trigger**: `main` 브랜치에 코드가 푸시되면 워크플로우가 시작됩니다.
2.  **Environment Setup**:
    - Ubuntu Latest 환경에서 실행됩니다.
    - Node.js 24 버전을 사용합니다 (`.nvmrc` 기준).
3.  **Install Dependencies**:
    - `npm install`을 통해 의존성을 설치합니다.
4.  **Build**:
    - `npm run build` 명령어로 프로젝트를 빌드합니다.
    - 빌드 시 `VITE_API_BASE_URL` 환경 변수가 주입됩니다.
5.  **AWS Authentication**:
    - AWS Access Key와 Secret Key를 사용하여 인증합니다.
    - 리전: `ap-northeast-1` (Tokyo)
6.  **Deploy to S3**:
    - 빌드된 `dist/` 디렉토리의 내용을 S3 버킷과 동기화합니다.
    - `--delete` 옵션을 사용하여 로컬 빌드 결과물에 없는 파일은 S3에서도 삭제합니다.
7.  **CloudFront Invalidation**:
    - 배포 후 즉시 변경 사항이 반영되도록 CloudFront 캐시를 무효화합니다.
    - 대상 경로: `/*`

### GitHub Actions 수동 재실행

`main` push 시 자동 트리거 외에, GitHub Actions 자체 장애 등으로 push 이벤트가
워크플로우를 트리거하지 못했을 때를 대비해 `workflow_dispatch`도 열어뒀다
(2026-08-06 GitHub Actions 장애로 실제로 이 문제가 발생 — 아래 "수동 배포"의
로컬 AWS CLI 방식과 달리 AWS 자격증명 없이, Actions 탭이나 `gh workflow run
deploy.yml`만으로 CI 파이프라인을 그대로 재실행할 수 있다).

```bash
gh workflow run deploy.yml --repo BAECHAN/link-sphere_FE_NEW --ref main
```

또는 GitHub 저장소 → Actions → "Frontend Deploy (S3 + CloudFront)" → Run workflow.

## 환경 변수 및 Secrets 설정

GitHub Repository의 **Settings > Secrets and variables > Actions** 메뉴에서 다음 Secrets를 설정해야 합니다.

| Secret 이름                  | 설명                     | 비고                       |
| :--------------------------- | :----------------------- | :------------------------- |
| `AWS_ACCESS_KEY_ID`          | AWS IAM 사용자 액세스 키 | S3 및 CloudFront 권한 필요 |
| `AWS_SECRET_ACCESS_KEY`      | AWS IAM 사용자 시크릿 키 |                            |
| `S3_BUCKET_NAME`             | 배포할 S3 버킷 이름      | 예: `link-sphere-frontend` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront 배포 ID       | 예: `E1234567890ABC`       |
| `VITE_API_BASE_URL`          | 백엔드 API 기본 URL      | 빌드 시점에 주입됨         |

## AWS IAM 권한 요구사항

배포에 사용되는 IAM 사용자는 최소한 다음 권한이 필요합니다.

- **S3**: `s3:PutObject`, `s3:ListBucket`, `s3:DeleteObject` (버킷 동기화용)
- **CloudFront**: `cloudfront:CreateInvalidation` (캐시 무효화용)

## CloudFront Function (수동 관리)

SPA 클라이언트 라우팅 폴백(`/post/abc123` 같은 경로를 `/index.html`로 리라이트)은
`link-sphere-spa-fallback`이라는 CloudFront Function이 담당한다. 소스는 이 저장소의
[`infra/cloudfront-functions/spa-fallback.js`](../infra/cloudfront-functions/spa-fallback.js).

- **이 Function은 위 `deploy.yml` 파이프라인이 배포하지 않는다** — `src/**` 변경 트리거 대상이
  아니고, 함수 코드가 바뀌는 일도 거의 없다. 변경이 필요하면 아래 절차를 수동으로 다시 실행한다.
- **반드시 기본(S3) 비헤이비어의 `viewer-request`에만 연결한다.** `/api/*` 비헤이비어에 연결하면
  BE(Lambda)의 정상 403/404 응답까지 `/index.html`로 가려버린다 — 실제로 2026-07-28에 이
  문제(구 방식인 배포 레벨 `CustomErrorResponses`가 원인)를 발견하고 이 Function으로 교체했다.
  `infra/` 디렉토리 자체의 역할과 자세한 배경은
  [`docs/SYSTEM-ARCHITECTURE.md`](./SYSTEM-ARCHITECTURE.md)의 "infra/ — AWS 인프라 직접 배포 코드" 절 참고.

```bash
# 1. 함수 코드 수정 후 업데이트 (기존 함수가 있으면 update-function, ETag 필요)
aws cloudfront describe-function --name link-sphere-spa-fallback --stage DEVELOPMENT
aws cloudfront update-function --name link-sphere-spa-fallback \
  --if-match <위 ETag> \
  --function-config '{"Comment":"SPA 클라이언트 라우팅 폴백 (기본 비헤이비어 전용; api 비헤이비어 미연결)","Runtime":"cloudfront-js-1.0"}' \
  --function-code fileb://infra/cloudfront-functions/spa-fallback.js

# 2. 테스트 (선택, 실배포 전 검증)
aws cloudfront test-function --name link-sphere-spa-fallback \
  --if-match <update 응답의 ETag> --stage DEVELOPMENT \
  --event-object fileb://<테스트 이벤트 JSON>

# 3. LIVE로 배포 (이미 비헤이비어에 연결돼 있다면 이걸로 자동 반영됨 — 배포 설정 재변경 불필요)
aws cloudfront publish-function --name link-sphere-spa-fallback --if-match <최신 ETag>
```

## CloudFront WAF (수동 관리)

CloudFront 배포에 `CreatedByCloudFront-bcd729fb`라는 WAF Web ACL(CLOUDFRONT 스코프,
us-east-1)이 붙어 있다. 이름에서 보이듯 CloudFront 콘솔에서 보안 보호를 켤 때 자동
생성된 것이고, 레포 어디에도 이 설정이 코드로 없다.

- **이 Web ACL은 어떤 파이프라인도 배포하지 않는다** — 콘솔 또는 AWS CLI로만 바꿀 수 있고,
  바뀐 사실이 git 이력에 전혀 남지 않는다. 바꿀 때마다 이 절을 갱신한다.
- **AWS 관리형 룰 `AWSManagedRulesCommonRuleSet`의 `SizeRestrictions_BODY`가 기본값
  그대로면 요청 바디 8,192바이트 초과를 무조건 차단한다.** 이 값은 ALB/AppSync
  기준이고, CloudFront는 원래 16KB(16,384바이트)까지 검사할 수 있는데도 8KB에서
  잘렸다 — 2026-09-06 발견 당시 실측으로 8,189바이트는 Lambda까지 도달(401),
  8,219바이트는 이 룰에 차단(403)됐다. 응답은 BE가 만든 JSON이 아니라 CloudFront가
  직접 반환하는 HTML(`403 ERROR` / `Request blocked.`)이라 BE `GlobalExceptionHandler`를
  전혀 타지 않는다 — 403 응답 body가 JSON이 아니라 HTML이면 이 문서를 먼저 볼 것.
  실제 영향은 댓글 등록·수정처럼 긴 텍스트를 보내는 API였다(BE `CHANGELOG.md` 참고).
- **바디 크기를 다시 차단하는 자체 룰은 만들지 않았다(중요, 처음 계획과 다름).** WAF의
  `SizeConstraintStatement`(커스텀 크기 제한 룰)는 CloudFront **Pro 플랜($15/월 정액제)
  이상에서만 지원**된다 — 이 계정은 Free 플랜이라
  `WAFFeatureNotIncludedInPricingPlanException`으로 거부됐다(2026-09-06 실측). Pro 업그레이드는
  비용이 걸린 결정이라 보류하고, `SizeRestrictions_BODY`를 Count로 오버라이드만 했다.
  **결과적으로 WAF 레이어의 바디 크기 방어선은 없다** — Lambda Function URL 자체 페이로드
  한도(6MB)까지는 뭐든 통과한다(300KB 페이로드로 실측 확인). 댓글 본문에 대한 유일한 크기
  방어는 이제 앱 레벨 검증(BE `CommentService.MAX_COMMENT_CONTENT_BYTES` = 12,000바이트)
  뿐이고, 그 외 엔드포인트는 크기 기반 방어가 전혀 없는 상태다. Pro 플랜으로 올리면 아래
  `BlockOversizedBody` 룰(주석 처리된 부분)을 추가해 이 갭을 메울 수 있다.
- 현재 룰 구성(우선순위순):
  1. `AWS-AWSManagedRulesAmazonIpReputationList` (관리형, 기본값)
  2. `AWS-AWSManagedRulesCommonRuleSet` — `SizeRestrictions_BODY`만 `RuleActionOverrides`로
     Count 처리(바디 크기로는 막지 않음). 다른 서브룰(XSS·LFI·RFI·Log4j 등)은 그대로 Block.
  3. `AWS-AWSManagedRulesKnownBadInputsRuleSet` (관리형, 기본값)

```bash
# 현재 설정 조회 (Rules 배열을 백업해두고 수정한다 - update-web-acl은 전체를 다시 보내야 함)
aws wafv2 get-web-acl --scope CLOUDFRONT --region us-east-1 \
  --name CreatedByCloudFront-bcd729fb --id 16fc99ed-1f67-4dec-9951-04806ce95699

# 재적용 (LockToken은 위 조회 응답의 최신 값으로 매번 교체)
aws wafv2 update-web-acl --scope CLOUDFRONT --region us-east-1 \
  --name CreatedByCloudFront-bcd729fb --id 16fc99ed-1f67-4dec-9951-04806ce95699 \
  --lock-token <위 LockToken> \
  --default-action Allow={} \
  --rules file://waf-rules.json \
  --visibility-config SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=CreatedByCloudFront-bcd729fb
```

`update-web-acl`은 Web ACL 리소스 자체 권한 외에 관리형 룰 오버라이드용 리소스
(`arn:...:global/managedruleset/*/*`)에 대한 권한도 별도로 필요하다 — `wafv2:UpdateWebACL`을
이 두 리소스 모두에 허용해야 한다. `wafv2:GetSampledRequests`(차단 샘플 조회, 진단용)도
같이 붙여두면 다음에 비슷한 문제가 생겼을 때 원인 파악이 빠르다.

**Pro 플랜으로 업그레이드해 바디 크기 차단을 되살리려면** 위 `waf-rules.json`의
`AWS-AWSManagedRulesCommonRuleSet` 앞(Priority 1)에 아래 룰을 추가한다 — inspection
limit(기본 16KB)과 같은 값으로 잡아야 검사 사각지대가 안 생긴다:

```json
{
  "Name": "BlockOversizedBody",
  "Priority": 1,
  "Statement": {
    "SizeConstraintStatement": {
      "FieldToMatch": { "Body": { "OversizeHandling": "MATCH" } },
      "ComparisonOperator": "GT",
      "Size": 16384,
      "TextTransformations": [{ "Priority": 0, "Type": "NONE" }]
    }
  },
  "Action": { "Block": {} },
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "BlockOversizedBody"
  }
}
```

```bash
# 검증: 정상 크기는 통과(401 = 인증만 실패, Lambda 도달)
URL="https://<cloudfront-domain>/api/post/00000000-0000-0000-0000-000000000000/comment"
BODY=$(python3 -c "import json;print(json.dumps({'content':'가'*4000,'images':[]},ensure_ascii=False))")
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$URL" -H 'Content-Type: application/json' --data-binary "$BODY"
# 기대: 401 (Pro 업그레이드 후 BlockOversizedBody를 추가했다면, 16KB 초과 페이로드는 403이어야 함)
```

## 수동 배포 (참고)

로컬 환경에서 수동으로 배포해야 할 경우 다음 명령어를 사용할 수 있습니다 (AWS CLI 설정 필요).
CI 파이프라인 자체를 재실행하려면(AWS 자격증명 불필요) 위 "GitHub Actions 수동 재실행"을 대신 쓴다.

```bash
# 1. 빌드
npm run build

# 2. S3 업로드 (버킷명 변경 필요)
aws s3 sync dist/ s3://<YOUR_BUCKET_NAME> --delete

# 3. CloudFront 무효화 (Distribution ID 변경 필요)
aws cloudfront create-invalidation --distribution-id <YOUR_DISTRIBUTION_ID> --paths "/*"
```
