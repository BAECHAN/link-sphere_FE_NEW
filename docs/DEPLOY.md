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

1.  **Trigger**: `main` 브랜치에 푸시되면 워크플로우가 시작됩니다 — 단, 경로 필터가
    걸려 있어 `src/**`·`public/**`·`package.json`·`pnpm-lock.yaml`·`vite.config.ts`·
    `tailwind.config.ts`·`postcss.config.js`·`index.html`·`tsconfig*.json` 중 하나라도
    바뀐 push에만 실행됩니다(`.github/workflows/deploy.yml`의 `on.push.paths`).
    즉 `CHANGELOG.md`나 `docs/` 아래 파일만 바뀐 push는 이 워크플로우를 **트리거하지
    않습니다** — 직전 배포가 실패해 있던 상태를 문서 수정 커밋으로 고쳤다고 착각하기
    쉬운 지점(사고 사례: [CI-CHECK-GATE.md §9.3](./CI-CHECK-GATE.md)). 이럴 때는 아래
    "GitHub Actions 수동 재실행"으로 직접 트리거해야 합니다.
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

`main` push 시 자동 트리거 외에, `workflow_dispatch`도 열어뒀다 — 아래 "수동
배포"의 로컬 AWS CLI 방식과 달리 AWS 자격증명 없이, Actions 탭이나 `gh
workflow run deploy.yml`만으로 CI 파이프라인을 그대로 재실행할 수 있다. 두
가지 실제 상황에서 이걸로 해결했다:

- **GitHub Actions 자체 장애로 push 이벤트가 워크플로우를 못 띄운 경우**
  (2026-08-06)
- **위 경로 필터 때문에 배포가 필요한데 최근 push가 그 필터에 안 걸린 경우**
  (2026-09-06, [CI-CHECK-GATE.md §9.3](./CI-CHECK-GATE.md) — 직전 push의 배포가
  실패해 있었는데, 그걸 고친 커밋이 `CHANGELOG.md`만 건드려 재배포가 안 걸림)

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
- **이 8KB 차단은 그대로 뒀다(2026-09-06, 완화를 시도했다가 원복).** 처음엔
  `SizeRestrictions_BODY`를 Count로 오버라이드해 8KB 벽을 없애려 했는데, 대체 크기
  제한 룰(`SizeConstraintStatement`)이 CloudFront **Pro 플랜($15/월 정액제) 이상에서만
  지원**돼(`WAFFeatureNotIncludedInPricingPlanException`, 이 계정은 Free 플랜) 실패했다.
  Count 오버라이드만 적용한 채로 두면 **WAF 레이어의 바디 크기 방어가 완전히 사라져**
  Lambda Function URL 자체 페이로드 한도(6MB)까지 뭐든 통과하는 걸 실측(300KB 페이로드)으로
  확인했고, 이건 비용·보안(다른 WAF 룰의 검사 한도 16KB를 넘겨 시그니처를 우회할 수 있음)
  양쪽에 새 노출이라 되돌렸다. 대신 앱(BE `CommentService.MAX_COMMENT_CONTENT_BYTES`,
  FE `entities/comment/config/const.ts`)이 이 8KB 벽 안쪽에서 여유 있게 동작하도록
  6,000바이트 상한을 뒀다 — 판단 근거는 `docs/DECISIONS.md` 참고.
- **Pro 플랜으로 업그레이드할 계획이 생기면** `SizeRestrictions_BODY`를 Count로 오버라이드하고
  inspection limit(기본 16KB)과 같은 크기로 `SizeConstraintStatement` 커스텀 룰(바디
  16,384바이트 초과 시 Block, `OversizeHandling: MATCH`)을 그 앞 우선순위에 추가하면
  8KB보다 넉넉한 한도로 다시 열 수 있다. `update-web-acl`은 Web ACL 리소스 자체 권한 외에
  관리형 룰 오버라이드용 리소스(`arn:...:global/managedruleset/*/*`)에 대한
  `wafv2:UpdateWebACL` 권한도 별도로 필요하다.
- **`CrossSiteScripting_BODY`는 2026-09-06부터 Block이 아니라 Count다(오탐 완화, 아래
  참고).** `SizeRestrictions_BODY`는 여전히 Block — 위 8KB 차단은 그대로 유효하다.

### `CrossSiteScripting_BODY` 오탐 완화 (2026-09-06)

`AWSManagedRulesCommonRuleSet`의 `CrossSiteScripting_BODY` 룰이 XSS와 무관한 정상
요청까지 광범위하게 오탐 차단하고 있었다. 실측(curl로 프로덕션에 직접 검증):

| 요청 본문                                                            | 결과      |
| -------------------------------------------------------------------- | --------- |
| `<META>` 태그 하나만                                                 | 403       |
| `<script>`, `<style>`, `<iframe>`, `onerror=`, `javascript:` 포함    | 403       |
| `React에서 <Button onClick={handleClick}>를 쓰면 됩니다` (정상 댓글) | 403       |
| `<a href="...">`, `<img src="...">`, `<div>안녕하세요</div>`         | 통과(401) |

`POST /post`(게시글 등록)·`PATCH /comment/{id}`(댓글 수정)도 동일 조건에서 403이 나
전역 문제였다. CloudWatch `AWS/WAFV2` `BlockedRequests`(`ManagedRuleGroupRule=
CrossSiteScripting_BODY`) 지표로 실제 이 룰의 차단임을 확정했다.

FE에 `dangerouslySetInnerHTML`·마크다운 라이브러리·HTML sanitizer가 전혀 없어(댓글은
`shared/ui/elements/MarkdownContent.tsx`가 HTML 문자열을 만들지 않는 자체 파서로
React 엘리먼트를 직접 조립) 이 룰이 막아주던 실질 위험이 거의 없다고 판단해
**Count로 완화**했다. 판단 근거·포기한 것(방어가 "FE가 React라서"에만 의존하게 됨)은
`docs/DECISIONS.md`의 2026-09-06 항목("크기가 아니라 WAF의 XSS 탐지 룰이 근본
원인이었다")에 상세 기록.

현재 룰 구성(우선순위순): `AWS-AWSManagedRulesAmazonIpReputationList` (오버라이드 없음) →
`AWS-AWSManagedRulesCommonRuleSet`(`CrossSiteScripting_BODY`만 Count, 나머지는 Block —
`SizeRestrictions_BODY` 포함) → `AWS-AWSManagedRulesKnownBadInputsRuleSet`(오버라이드 없음).

```bash
# 조회 (수정 전 반드시 백업 - update-web-acl은 전체 Rules 배열을 다시 보내야 함)
aws wafv2 get-web-acl --scope CLOUDFRONT --region us-east-1 \
  --name CreatedByCloudFront-bcd729fb --id 16fc99ed-1f67-4dec-9951-04806ce95699

# 검증 1: 8KB 이내는 통과(401 = 인증만 실패, Lambda 도달), 초과는 403(WAF 차단)
URL="https://<cloudfront-domain>/api/post/00000000-0000-0000-0000-000000000000/comment"
BODY=$(python3 -c "import json;print(json.dumps({'content':'가'*2000,'images':[]},ensure_ascii=False))")
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$URL" -H 'Content-Type: application/json' --data-binary "$BODY"
# 기대: 401

# 검증 2: XSS 오탐 완화 확인 - 아래는 이제 401(통과)이어야 한다
BODY2=$(python3 -c "import json;print(json.dumps({'content':'React에서 <Button onClick={x}>를 씁니다','images':[]},ensure_ascii=False))")
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$URL" -H 'Content-Type: application/json' --data-binary "$BODY2"
# 기대: 401 (Count로 내리기 전에는 403이었다)
```

**되돌리려면**(재발 시): `AWS-AWSManagedRulesCommonRuleSet`의
`RuleActionOverrides`에서 `CrossSiteScripting_BODY` 항목을 제거하고
`update-web-acl`로 재적용.

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
