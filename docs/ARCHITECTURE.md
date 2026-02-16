# 프론트엔드 아키텍처 문서

## 1. React Query 설정

### `queryClient.ts`

애플리케이션은 `src/shared/lib/react-query/config/queryClient.ts`에 정의된 중앙 집중식 `QueryClient` 인스턴스를 사용합니다.

#### 전역 설정

- **Stale Time**: 3분 (`3 * 60 * 1000`)
- **GC Time**: 5분 (`5 * 60 * 1000`)
- **Retry**: 실패 시 1회 재시도
- **Refetch**: 윈도우 포커스 및 마운트 시

## 2. 에러 핸들링 전략

애플리케이션은 사용자 경험과 개발자 제어의 균형을 맞추기 위해 계층화된 에러 핸들링 전략을 구현합니다.

### 전역 에러 핸들링

전역 에러 핸들러는 `queryClient.ts` 내의 `mutationCache`와 `queryCache`에 정의되어 있습니다.

- **API 에러 (`ApiError`)**:
  - 상세한 에러 데이터와 함께 자동으로 콘솔에 로깅됩니다.
  - 보안과 UX 일관성을 위해 사용자에게는 일반적인 "서버 에러" 메시지를 토스트 알림으로 표시합니다.
- **알 수 없는 에러**:
  - 콘솔에 로깅됩니다.
  - 일반적인 에러 메시지를 토스트로 표시합니다.

### 수동 에러 핸들링 (`manualErrorHandling`)

특정 기능에서 맞춤형 에러 핸들링 로직이 필요한 경우가 있습니다(예: 서버에서 받은 유효성 검사 에러를 폼 필드에 표시). 이런 경우 전역 에러 핸들러를 우회할 수 있습니다.

#### 사용 방법

mutation 또는 query의 `meta` 옵션에 `manualErrorHandling: true`를 추가합니다.

```typescript
const { mutate } = useMutation({
  mutationFn: someApiFunction,
  meta: {
    manualErrorHandling: true, // 전역 토스트 에러 비활성화
  },
  onError: (error) => {
    // 여기에 맞춤 에러 핸들링 로직 구현
    if (error instanceof ApiError && error.status === 409) {
      form.setError('email', { message: '이미 존재하는 이메일입니다' });
    }
  },
});
```

### 커스텀 에러 메시지

전역 핸들러를 완전히 비활성화하지 않고도 `meta`를 통해 커스텀 에러 메시지를 제공할 수 있습니다.

```typescript
const { mutate } = useMutation({
  mutationFn: someApiFunction,
  meta: {
    errorMessage: '프로필 업데이트에 실패했습니다. 다시 시도해주세요.',
  },
});
```

## 3. 토스트 알림 (Sonner)

애플리케이션은 전역 에러 핸들링 시스템과 통합된 [Sonner](https://sonner.emilkowal.ski/)를 토스트 알림에 사용합니다.

- **시스템 에러**: 전역 에러 핸들러에 의해 자동으로 트리거됩니다.
- **성공 메시지**: `meta`에 `successMessage`를 추가하여 자동으로 트리거할 수 있습니다.

```typescript
const { mutate } = useMutation({
  mutationFn: updateProfile,
  meta: {
    successMessage: '프로필이 성공적으로 업데이트되었습니다!',
  },
});
```

## 4. Form 컴포넌트 구조

Form 관련 컴포넌트는 `src/shared/ui/elements/form/` 디렉토리에 구조화되어 있습니다.

### 디렉토리 구조

```
src/shared/ui/elements/form/
├── _base/
│   └── FormField.tsx        # 레이블, 에러 메시지 관리
├── FormInput.tsx            # 일반 입력 필드
├── FormInputPassword.tsx    # 비밀번호 입력 필드
└── FormCheckboxGroup.tsx    # 체크박스 그룹
```

### FormField (기본 컴포넌트)

`FormField`는 폼 필드의 레이블, 설명, 에러 메시지를 일관되게 관리하는 래퍼 컴포넌트입니다.

- **props**:
  - `label`: 필드 레이블
  - `description` (optional): 안내 텍스트 (에러 발생 시 에러 메시지로 대체됨)
  - `required` (optional): 필수 필드 표시
  - `name`: react-hook-form 필드 이름

## 5. 인증 (Auth) 도메인 구조

인증 관련 로직은 `src/domains/auth/` 디렉토리에 구조화되어 있습니다.

### 스키마 구조

모든 인증 관련 스키마는 `Account` 중심으로 통일되어 있습니다:

- **Account**: 사용자 계정 정보 (id, email, name, avatarUrl, createdAt, updatedAt)
- **Login**: 로그인 요청 스키마
- **CreateAccount**: 회원가입 요청 스키마
- **AuthTokens**: 인증 토큰 (accessToken, refreshToken)

### API 및 Query 구조

```typescript
// auth.api.ts
export const authApi = {
  login: (payload: Login) => Promise<LoginResponse>,
  createAccount: (payload: CreateAccount) => Promise<Account>,
  logout: () => Promise<void>,
  refreshToken: () => Promise<AuthTokens>,
  fetchAccount: () => Promise<Account>,
};

// auth.queries.ts
export const useLoginMutation = () => {...}
export const useCreateAccountMutation = () => {...}
export const useFetchAccountQuery = () => {...}
```

### 에러 핸들링

회원가입(`useCreateAccountMutation`)은 `manualErrorHandling: true`를 사용하여 409 Conflict 에러를 특별히 처리합니다:

```typescript
onError: (error) => {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      toast.error('이미 존재하는 계정입니다');
    } else {
      toast.error('계정 생성에 실패했습니다');
    }
  }
};
```
