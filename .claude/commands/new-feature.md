Add a new feature to an existing domain in the Link-Sphere FE project.

## Argument format

"$ARGUMENTS" — format: `<domain-name> <feature-name>`

Examples: `post create`, `auth signup`, `member update`

Parse:

- Domain name (kebab-case): first word
- Feature name (kebab-case, 동사만 — "완결된 사용자 액션/flow"가 아니면 `<domain>-<action>` 형태로 합치지 않는다): remaining words
- Hook name (PascalCase): e.g. "create" (in domain `post`) → "CreatePost"

## Before creating files

1. Read the existing entity's `entities/<entity>/api/` to understand which mutations/queries already exist
2. Read an existing feature hook (e.g. `src/features/post/create/hooks/useCreatePost.ts`) to match the exact style
3. If the required mutation/query hook doesn't exist yet in `<entity>.queries.ts`, create it there first

## Files to create

### 1. `src/features/<domain>/<slice>/hooks/use<FeatureName>.ts`

**Form-based feature (create/update):**

```typescript
import { use<Action><Entity>Mutation } from '@/entities/<entity>/api/<entity>.queries';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { <FormType>, <formSchema> } from '@/entities/<entity>/model/<entity>.schema';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';

const DEFAULT_VALUES: <FormType> = {
  // fill with actual default values
};

export function use<FeatureName>() {
  const navigate = useNavigate();
  const { mutateAsync: <action><Entity>, isPending: is<Action>ing } = use<Action><Entity>Mutation();

  const form = useForm<<FormType>>({
    resolver: zodResolver(<formSchema>),
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });

  // 폼에 값을 입력하고 제출 없이 떠나면(뒤로가기 등) 이탈 확인창을 띄운다 — 선례:
  // useCreatePost.ts. 첫 인자는 페이지별 고유 키(라우트/슬라이스 이름과 맞춘다).
  const { clearNow } = useUnsavedChanges('<domain>-<slice>', form.formState.isDirty);

  const onSubmit = form.handleSubmit(async (formData: <FormType>) => {
    // 응답을 기다렸다가 성공했을 때만 폼을 비우고 이동한다 — 실패하면 입력·이탈 가드를 그대로
    // 남겨 바로 다시 시도할 수 있게 한다(선례: useCreatePost.ts). 에러 토스트는 전역 핸들러가
    // mutation의 meta.errorMessage로 이미 띄우므로 여기서는 reject만 받고 다시 던지지 않는다 —
    // 던지면 handleSubmit 밖으로 처리되지 않은 rejection이 샌다.
    try {
      await <action><Entity>(formData);
    } catch {
      return;
    }

    clearNow();
    form.reset(DEFAULT_VALUES);
    // replace: 제출이 끝난 폼 엔트리를 결과 화면으로 대체 → 뒤로가기 시 빈 폼으로 돌아가지 않음
    navigate(ROUTES_PATHS.<DOMAIN>.ROOT, { replace: true });
  });

  return { form, onSubmit, is<Action>ing };
}
```

**Delete-only feature (no form):**

```typescript
import { useDelete<Entity>Mutation } from '@/entities/<entity>/api/<entity>.queries';
import { useAlert } from '@/shared/ui/elements/dialog/alert/alert.store';
import { TEXTS } from '@/shared/config/texts';

export function use<FeatureName>() {
  const { mutateAsync: delete<Entity>, isPending: isDeleting } = useDelete<Entity>Mutation();
  const { openConfirm } = useAlert();

  const onDelete = (id: string, options?: { onSuccess?: () => void }) => {
    openConfirm({
      message: TEXTS.messages.warning.<entity>DeleteConfirm,
      confirmText: TEXTS.buttons.delete,
      // 메뉴에서 "삭제"를 직접 눌러야만 뜨는 다이얼로그라 이미 삭제를 결심한 상태다 —
      // 확인이 채움+오른쪽을 받는다(usePostDelete.ts와 동일, docs/DECISIONS.md
      // 2026-09-29 항목 참고).
      emphasis: 'confirm',
      onConfirm: async () => {
        await delete<Entity>(id);
        options?.onSuccess?.();
      },
    });
  };

  return { onDelete, isDeleting };
}
```

**Toggle/action feature (no form, no confirm):**

```typescript
import { use<Action><Entity>Mutation } from '@/entities/<entity>/api/<entity>.queries';

export function use<FeatureName>(<entity>Id: string) {
  const { mutate: <action><Entity>, isPending: is<Action>ing } = use<Action><Entity>Mutation(<entity>Id);

  const handle<Action> = () => { <action><Entity>(); };

  return { handle<Action>, is<Action>ing };
}
```

### 2. `src/features/<domain>/<slice>/ui/<FeatureName>.tsx`

**Form UI:**

```typescript
import { FormProvider } from 'react-hook-form';
import { use<FeatureName> } from '@/features/<domain>/<slice>/hooks/use<FeatureName>';
import { Button } from '@/shared/ui/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { TEXTS } from '@/shared/config/texts';

// 한글 UI 문자열 하드코딩 금지(custom-i18n/no-hardcoded-hangul) — TEXTS.<domain>.form.<slice>.*에
// 먼저 키를 추가하고 참조한다. 응답을 기다리는 동안 라벨을 TEXTS.common.submitting(수정 폼이면
// updating)으로 바꾼다 — CreatePostForm과 동일(docs/FE-ARCHITECTURE.md §10-A "저장 중 라벨").
export function <FeatureName>Form() {
  const { form, onSubmit, is<Action>ing } = use<FeatureName>();
  const { isDirty, isValid } = form.formState;
  const canSubmit = isDirty && isValid && !is<Action>ing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TEXTS.<domain>.form.<slice>.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {/* TODO: add FormInput, FormCheckbox, FormCheckboxGroup fields (@/shared/ui/elements/form/) */}
            <Button type="submit" className="w-full h-11" disabled={!canSubmit}>
              {is<Action>ing ? TEXTS.common.submitting : TEXTS.<domain>.form.<slice>.submit}
            </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
```

**Button UI (toggle/action):**

```typescript
import { cn } from '@/shared/lib/tailwind/utils';
import { ToggleButton } from '@/shared/ui/elements/ToggleButton';
import { use<FeatureName> } from '@/features/<domain>/<slice>/hooks/use<FeatureName>';
import { TEXTS } from '@/shared/config/texts';

interface <FeatureName>ButtonProps {
  <entity>Id: string;
  is<State>: boolean;
  count?: number;
}

export function <FeatureName>Button({ <entity>Id, is<State>, count }: <FeatureName>ButtonProps) {
  const { handle<Action> } = use<FeatureName>(<entity>Id);

  // 누를 때마다 상태를 뒤집는 버튼이라 Button 대신 ToggleButton(더블클릭 가드 내장)을 쓴다.
  // 낙관적 업데이트로 아이콘이 먼저 바뀌는 토글엔 요청 중 disabled를 두지 않는다 — 버튼만
  // 흐려졌다 돌아오는 깜빡임이 생긴다(docs/FE-ARCHITECTURE.md §10-A, 선례: LikePostButton.tsx).
  return (
    <ToggleButton
      variant="ghost"
      size="sm"
      className={cn('gap-1 rounded-full', is<State> && 'text-primary')}
      onClick={(e) => { e.preventDefault(); handle<Action>(); }}
      // 아이콘만 있고 텍스트 라벨이 없는 버튼이라 스크린리더용 라벨이 꼭 필요하다
      // (선례: LikePostButton.tsx). 상태별로 다른 문구를 TEXTS.ariaLabels.*에 추가한다.
      aria-label={is<State> ? TEXTS.ariaLabels.<domain><FeatureName>Off : TEXTS.ariaLabels.<domain><FeatureName>On}
    >
      {/* icon + count */}
    </ToggleButton>
  );
}
```

## After creating files

Tell the user:

- Wire the new UI component into the appropriate page under `src/pages/`. If wiring it in
  needs any orchestration logic of its own (URL parsing, an entity query call, a redirect
  effect), that logic goes in that page's `hooks/` — entity queries can only be called from
  `hooks/` there too (`custom-query-rules/no-entity-query-import-outside-hooks` covers
  `pages/**` the same as `features/**`), not inlined in the page component itself
- If mutation/query hooks were missing from `<entity>.queries.ts`, confirm they were added
- If new TEXTS keys were referenced, confirm they were added to `src/shared/config/texts.ts`
