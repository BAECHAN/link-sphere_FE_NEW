# 프롬프트 템플릿: 기존 코드를 프로젝트 패턴으로 리팩터링

**사용법**: 대괄호 `[ ]` 안의 내용을 채운 뒤 Claude Code에 붙여넣으세요.
**코드 리뷰 먼저**: `/code-review` 로 문제점을 파악한 뒤 이 템플릿 사용 권장

---

아래 경로의 코드를 Link-Sphere FE 아키텍처 패턴에 맞게 리팩터링해주세요.

## 대상 파일

```
[파일 경로들, 예:]
src/domains/post/features/create-post/hooks/useCreatePost.ts
src/domains/post/features/create-post/ui/CreatePostForm.tsx
```

## 발견된 문제점

해당하는 항목에 체크:

**레이어 분리 위반:**

- [ ] API 호출이 feature hook 안에 있음 (→ `<entity>.api.ts`로 이동해야 함)
- [ ] React Query 훅이 feature hook에 선언되어 있음 (→ `<entity>.queries.ts`로 이동해야 함)
- [ ] 비즈니스 로직이 UI 컴포넌트 안에 있음 (→ feature hook으로 추출해야 함)
- [ ] queryClient를 feature hook에서 직접 조작함 (→ `.keys.ts` success handler 사용해야 함)

**패턴 위반:**

- [ ] `confirm()` 사용 (→ `useAlert` + `openConfirm`으로 교체해야 함)
- [ ] 하드코딩된 UI 문자열 (→ `TEXTS.*`로 이동해야 함)
- [ ] 하드코딩된 API 경로 (→ `API_ENDPOINTS.*` 사용해야 함)
- [ ] 하드코딩된 라우트 경로 (→ `ROUTES_PATHS.*` 사용해야 함)
- [ ] 인라인 쿼리 키 문자열 배열 (→ `<entity>Keys.*` 사용해야 함)

**TypeScript 품질:**

- [ ] `any` 타입 사용
- [ ] 수동 TypeScript interface 선언 (→ `z.infer<typeof schema>` 사용해야 함)
- [ ] nullable 필드에 `T | undefined` 사용 (→ `T | null` 또는 `.nullable()` 사용해야 함)

**기타:**

- [ ] [직접 기술]

## 리팩터링 제약 조건

- 외부 동작은 변경하지 않음 — 리팩터링 후에도 기능은 동일하게 동작해야 함
- 이미 다른 파일에서 사용 중인 컴포넌트의 prop 인터페이스는 변경하지 않음
- 기존 유효성 검사 메시지는 보존하고, 하드코딩된 것은 `TEXTS.*`로 이동
- 새로운 파일이 필요하면 프로젝트 패턴에 맞게 생성 가능

## 목표 구조

리팩터링 후 이 구조를 따라야 함:

```
src/domains/<domain>/features/<feature-name>/
├── hooks/
│   └── use<FeatureName>.ts     # 모든 로직: form, mutation, navigation, confirm
└── ui/
    └── <FeatureName>Form.tsx    # 얇은 UI: 훅 호출 + JSX 렌더링만

src/domains/<domain>/_common/api/
├── <entity>.api.ts       # apiClient.get/post/patch/delete 호출만
├── <entity>.keys.ts      # 쿼리 키 + invalidation + success handlers
└── <entity>.queries.ts   # useMutation / useQuery 래퍼만
```

## 추가 컨텍스트

[필요한 경우 백엔드 API 명세나 현재 버그 상황 기술]
