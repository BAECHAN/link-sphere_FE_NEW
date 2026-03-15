# 마이페이지 (프로필 수정) 기능

## 개요

네비게이션 바 아바타 드롭다운에서 **프로필 수정** 메뉴를 클릭하면 모달이 열립니다.
닉네임 변경 및 프로필 이미지(아바타) 교체를 지원합니다.

---

## 파일 구조

```
src/
├── widgets/
│   └── layout/
│       └── mypage/
│           └── ui/
│               └── MyPageModal.tsx          # Dialog 래퍼 (Radix UI)
├── features/
│   └── auth/
│       └── profile/
│           ├── ui/
│           │   └── UpdateProfileForm.tsx    # 닉네임 Input + 아바타 업로드 폼
│           └── hooks/
│               ├── useUpdateProfile.ts      # 폼 상태·제출·이미지 미리보기 로직
│               └── useUpdateProfile.test.tsx
├── entities/
│   └── user/
│       ├── api/
│       │   ├── auth.api.ts                  # updateAccount, uploadAvatar API 메서드
│       │   ├── auth.queries.ts              # useUpdateAccountMutation, useUploadAvatarMutation
│       │   └── auth.keys.ts                 # handleAccountUpdateSuccess (cross-invalidation)
│       └── ui/
│           └── UserAvatar.tsx               # 공통 아바타 컴포넌트
└── shared/
    ├── config/
    │   ├── api.ts                           # updateAccount, uploadAvatar 엔드포인트
    │   └── texts.ts                         # mypage, success/error 텍스트 상수
    └── types/
        └── auth.type.ts                     # updateAccountSchema, AvatarUploadResponse
```

---

## API 엔드포인트

| 메서드  | 경로                   | 설명                                           |
| ------- | ---------------------- | ---------------------------------------------- |
| `PATCH` | `/auth/account`        | 닉네임·이미지 URL 업데이트                     |
| `POST`  | `/auth/account/avatar` | 이미지 파일 업로드 → Supabase Storage URL 반환 |

### Request / Response

**PATCH /auth/account**

```json
// Request Body
{ "nickname": "newNick", "image": "https://..." }

// Response
{
  "status": 200,
  "data": { "id": "...", "email": "...", "nickname": "newNick", "image": "https://...", ... }
}
```

**POST /auth/account/avatar** (`multipart/form-data`)

```json
// field: "file" (이미지 파일)

// Response
{
  "status": 200,
  "data": { "imageUrl": "https://supabase.co/storage/v1/object/public/..." }
}
```

---

## 주요 구현 사항

### 1. Zod 스키마 — `image: z.string().nullish()`

BE Kotlin `String?` 타입은 JSON `null`로 직렬화됩니다.
`z.string().optional()`은 `null`을 거부하므로 `updateAccountSchema`에서 `image` 필드에 `.nullish()` 사용.

```typescript
export const updateAccountSchema = z.object({
  nickname: nicknameValidationSchema,
  image: z.string().nullish(), // null | undefined | string 모두 허용
});
```

### 2. 아바타 업로드 2단계 흐름

```
1. 사용자가 파일 선택 → pendingFile 상태 저장, objectURL로 미리보기
2. 제출 시: uploadAvatar(file) → imageUrl 반환
3. updateAccount({ nickname, image: imageUrl }) 호출
```

파일 선택만 해도 미리보기가 즉시 표시되고, 저장 버튼 클릭 시에만 실제 업로드가 발생합니다.

### 3. isDirty 감지

React Hook Form의 `formState.isDirty`는 registered 필드(nickname)만 감지합니다.
`image`는 폼에 등록되지 않으므로 `pendingFile !== null` 조건을 OR로 결합합니다.

```typescript
isDirty: form.formState.isDirty || pendingFile !== null;
```

저장하기 버튼은 변경사항이 없으면 비활성화됩니다.

### 4. Cross-entity 캐시 무효화

프로필(닉네임·이미지) 변경 후 account 쿼리뿐 아니라 포스트 목록도 갱신해야
카드에 표시되는 작성자 아바타가 새 이미지로 교체됩니다.

```typescript
// auth.keys.ts
export const handleAccountUpdateSuccess = () => {
  authInvalidateQueries.account(); // GET /auth/account 재요청
  postInvalidateQueries.list(); // 포스트 목록 재요청 → 카드 작성자 아바타 갱신
};
```

### 5. 아바타 깜빡임 방지 — 조건부 Fallback 렌더링

Radix UI `Avatar`는 이미지 로드 실패 시에만 `AvatarFallback`을 표시합니다.
이미지가 있을 때 `AvatarFallback`을 렌더링하면 로딩 중 → Fallback → 이미지 순으로 깜빡입니다.

**해결:** 이미지가 없을 때만 `AvatarFallback`을 조건부 렌더링합니다.

```tsx
<Avatar>
  <AvatarImage src={image ?? ''} />
  {!image && <AvatarFallback>{initial}</AvatarFallback>}
</Avatar>
```

이미지가 있는 경우 Fallback이 DOM에 없으므로 브라우저 캐시에서 이미지가 즉시 로드되며 깜빡임이 발생하지 않습니다.

---

## 로그아웃 처리 개선

기존 `useLogoutMutation`은 서버 응답을 기다린 뒤 `clearAll()`을 호출했습니다.
응답 지연 시 사용자가 여전히 인증된 것처럼 보이는 문제가 있었습니다.

**변경:** 즉시 상태 초기화 후 서버 요청을 fire-and-forget으로 처리합니다.

```typescript
const logout = () => {
  authApi.logout().catch(console.error); // 1. 서버 요청 (응답 무관)
  AuthUtil.clearAll(); // 2. 즉시 상태 초기화 → ProtectedRoute redirect
  unregisterFcmToken().catch(console.error); // 3. FCM 해제 (백그라운드)
};
```

---

## Supabase Storage 버킷 구조

아바타 이미지는 `SupabaseStorageService.uploadFile(file)` (기본 버킷)을 사용합니다.
댓글 이미지는 `uploadFile(file, "comments")` 형태로 버킷을 명시합니다.

```kotlin
// SupabaseStorageService.kt
fun uploadFile(file: MultipartFile): String = uploadFile(file, bucketName) // 기본 버킷 사용
fun uploadFile(file: MultipartFile, bucket: String): String { ... }        // 버킷 명시
```

---

## MSW 목업 (테스트 환경)

```typescript
// src/mocks/handlers/auth.handlers.ts
http.patch(url('/auth/account'), ...)       // 프로필 수정 mock
http.post(url('/auth/account/avatar'), ...) // 아바타 업로드 mock (고정 URL 반환)
```

테스트 실행 시 실제 API를 호출하지 않고 MSW가 인터셉트합니다.
