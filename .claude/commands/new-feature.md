Add a new feature to an existing domain in the Link-Sphere FE project.

## Argument format

"$ARGUMENTS" — format: `<domain-name> <feature-name>`

Examples: `post create-post`, `auth sign-up`, `member update-profile`

Parse:

- Domain name (kebab-case): first word
- Feature name (kebab-case): remaining words
- Hook name (PascalCase): e.g. "create-post" → "CreatePost"

## Before creating files

1. Read the existing domain's `_common/api/` to understand which mutations/queries already exist
2. Read an existing feature hook (e.g. `src/domains/post/features/create-post/hooks/useCreatePost.ts`) to match the exact style
3. If the required mutation/query hook doesn't exist yet in `<entity>.queries.ts`, create it there first

## Files to create

### 1. `src/domains/<domain>/features/<feature-name>/hooks/use<FeatureName>.ts`

**Form-based feature (create/update):**

```typescript
import { use<Action><Entity>Mutation } from '@/domains/<domain>/_common/api/<entity>.queries';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { <FormType>, <formSchema> } from '@/domains/<domain>/_common/model/<entity>.schema';
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
import { useDelete<Entity>Mutation } from '@/domains/<domain>/_common/api/<entity>.queries';
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
import { use<Action><Entity>Mutation } from '@/domains/<domain>/_common/api/<entity>.queries';

export function use<FeatureName>(<entity>Id: string) {
  const { mutateAsync: <action><Entity>, isPending: is<Action>ing } = use<Action><Entity>Mutation(<entity>Id);

  const handle<Action> = () => { <action><Entity>(); };

  return { handle<Action>, is<Action>ing };
}
```

### 2. `src/domains/<domain>/features/<feature-name>/ui/<FeatureName>.tsx`

**Form UI:**

```typescript
import { FormProvider } from 'react-hook-form';
import { use<FeatureName> } from '../hooks/use<FeatureName>';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { Button } from '@/shared/ui/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/atoms/card';

export function <FeatureName>Form() {
  const { form, onSubmit, is<Action>ing } = use<FeatureName>();
  const { isDirty, isValid } = form.formState;
  const canSubmit = isDirty && isValid && !is<Action>ing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>제목</CardTitle>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {/* TODO: add FormInput, FormCheckbox, FormCheckboxGroup fields */}
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {is<Action>ing ? '처리 중...' : '제출'}
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
