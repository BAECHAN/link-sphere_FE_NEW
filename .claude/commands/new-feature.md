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

  const onSubmit = form.handleSubmit(async (data: <FormType>) => {
    try {
      await <action><Entity>(data, {
        onSuccess: () => {
          form.reset(DEFAULT_VALUES);
          navigate(ROUTES_PATHS.<DOMAIN>.ROOT);
        },
      });
    } catch (error) {
      console.error(error);
    }
  });

  return { form, onSubmit, is<Action>ing };
}
```

**Delete-only feature (no form):**

```typescript
import { useDelete<Entity>Mutation } from '@/entities/<entity>/api/<entity>.queries';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';
import { TEXTS } from '@/shared/config/texts';

export function use<FeatureName>() {
  const { mutateAsync: delete<Entity>, isPending: isDeleting } = useDelete<Entity>Mutation();
  const { openConfirm } = useAlert();

  const onDelete = (id: string, options?: { onSuccess?: () => void }) => {
    openConfirm({
      message: TEXTS.messages.warning.<entity>DeleteConfirm,
      confirmText: TEXTS.buttons.delete,
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
import { use<FeatureName> } from '../hooks/use<FeatureName>';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { Button } from '@/shared/ui/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { TEXTS } from '@/shared/config/texts';

// 한글 UI 문자열 하드코딩 금지(custom-i18n/no-hardcoded-hangul) — TEXTS.<domain>.form.<slice>.*에
// 먼저 키를 추가하고 참조한다. 로딩 중 라벨을 따로 바꾸지 않는다 — 기존 코드(CreatePostForm)도
// disabled만으로 pending을 표시하고 텍스트는 고정이다.
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
            {/* TODO: add FormInput, FormCheckbox, FormCheckboxGroup fields */}
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {TEXTS.<domain>.form.<slice>.submit}
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
import { Button } from '@/shared/ui/atoms/button';
import { use<FeatureName> } from '../hooks/use<FeatureName>';

interface <FeatureName>ButtonProps {
  <entity>Id: string;
  is<State>: boolean;
  count?: number;
}

export function <FeatureName>Button({ <entity>Id, is<State>, count }: <FeatureName>ButtonProps) {
  const { handle<Action>, is<Action>ing } = use<FeatureName>(<entity>Id);

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('gap-1 rounded-full', is<State> && 'text-primary')}
      onClick={(e) => { e.preventDefault(); handle<Action>(); }}
      disabled={is<Action>ing}
    >
      {/* icon + count */}
    </Button>
  );
}
```

## After creating files

Tell the user:

- Wire the new UI component into the appropriate page under `src/pages/`
- If mutation/query hooks were missing from `<entity>.queries.ts`, confirm they were added
- If new TEXTS keys were referenced, confirm they were added to `src/shared/config/texts.ts`
