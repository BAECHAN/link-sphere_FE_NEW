import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { FormProvider } from 'react-hook-form';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { FormCheckboxGroup } from '@/shared/ui/elements/form/FormCheckboxGroup';
import { FormCheckbox } from '@/shared/ui/elements/form/FormCheckbox';
import { useFetchCategoryOptionQuery } from '@/shared/api/common.queries';
import { useUpdatePost } from '@/features/post/update/hooks/useUpdatePost';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import { TEXTS } from '@/shared/config/texts';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface UpdatePostFormProps {
  postId: string;
}

export function UpdatePostForm({ postId }: UpdatePostFormProps) {
  const { form, post, isLoading, isUpdating, onSubmit } = useUpdatePost(postId);
  const { data: categoryOptionList } = useFetchCategoryOptionQuery();

  const {
    formState: { isDirty, isValid },
  } = form;

  const canSubmit = isDirty && isValid && !isUpdating;

  if (isLoading) return <SpinnerOverlay />;

  return (
    <div className="flex justify-center w-full md:py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{TEXTS.post.form.update.title}</CardTitle>
          <CardDescription>{TEXTS.post.form.update.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {post && (
            <div className="mb-4 p-3 bg-muted/40 rounded-md text-sm text-muted-foreground flex items-center gap-2">
              <span className="truncate flex-1">{post.url}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  navigator.clipboard.writeText(post.url);
                  toast.success(TEXTS.messages.success.linkCopied);
                }}
                className="shrink-0 hover:text-foreground"
              >
                <Copy size={14} />
              </Button>
            </div>
          )}
          <FormProvider {...form}>
            <form onSubmit={onSubmit} className="space-y-4 md:space-y-6" noValidate>
              <FormInput
                name="title"
                label={TEXTS.post.form.update.titleLabel}
                placeholder={TEXTS.post.form.update.titlePlaceholder}
                required
                disabled={isUpdating}
              />
              <FormCheckboxGroup
                name="categoryIds"
                label={TEXTS.post.form.update.categoryLabel}
                options={categoryOptionList ?? []}
                disabled={isUpdating}
              />

              <div className="pt-2">
                <FormCheckbox
                  name="isPrivate"
                  label={TEXTS.post.form.update.privateLabel}
                  description={TEXTS.post.form.update.privateDescription}
                  disabled={isUpdating}
                />
              </div>

              <Button className="w-full h-11 text-base" disabled={!canSubmit}>
                {isUpdating ? TEXTS.post.form.update.updating : TEXTS.post.form.update.update}
              </Button>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}
