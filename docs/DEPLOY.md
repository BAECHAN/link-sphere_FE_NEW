# 배포 가이드 (Deployment Guide)

이 문서는 Link Sphere Frontend 애플리케이션의 배포 아키텍처와 GitHub Actions를 이용한 자동화 절차에 대해 설명합니다.

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
    - Node.js 20 버전을 사용합니다.
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

## 환경 변수 및 Secrets 설정

GitHub Repository의 **Settings > Secrets and variables > Actions** 메뉴에서 다음 Secrets를 설정해야 합니다.

| Secret 이름 | 설명 | 비고 |
| :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | AWS IAM 사용자 액세스 키 | S3 및 CloudFront 권한 필요 |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM 사용자 시크릿 키 | |
| `S3_BUCKET_NAME` | 배포할 S3 버킷 이름 | 예: `link-sphere-frontend` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront 배포 ID | 예: `E1234567890ABC` |
| `VITE_API_BASE_URL` | 백엔드 API 기본 URL | 빌드 시점에 주입됨 |

## AWS IAM 권한 요구사항

배포에 사용되는 IAM 사용자는 최소한 다음 권한이 필요합니다.

- **S3**: `s3:PutObject`, `s3:ListBucket`, `s3:DeleteObject` (버킷 동기화용)
- **CloudFront**: `cloudfront:CreateInvalidation` (캐시 무효화용)

## 수동 배포 (참고)

로컬 환경에서 수동으로 배포해야 할 경우 다음 명령어를 사용할 수 있습니다 (AWS CLI 설정 필요).

```bash
# 1. 빌드
npm run build

# 2. S3 업로드 (버킷명 변경 필요)
aws s3 sync dist/ s3://<YOUR_BUCKET_NAME> --delete

# 3. CloudFront 무효화 (Distribution ID 변경 필요)
aws cloudfront create-invalidation --distribution-id <YOUR_DISTRIBUTION_ID> --paths "/*"
```
