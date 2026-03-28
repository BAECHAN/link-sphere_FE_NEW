import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { useCreatePost } from '@/features/post/create/hooks/useCreatePost';
import { FormProvider } from 'react-hook-form';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { FormCheckboxGroup } from '@/shared/ui/elements/form/FormCheckboxGroup';
import { FormCheckbox } from '@/shared/ui/elements/form/FormCheckbox';
import { useFetchCategoryOptionQuery } from '@/shared/api/common.queries';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
import { TEXTS } from '@/shared/config/texts';

export function CreatePostForm() {
  const { form, onSubmit, isCreating } = useCreatePost();
  const { data: categoryOptionList } = useFetchCategoryOptionQuery();

  const {
    formState: { isDirty, isValid },
  } = form;

  const canSubmit = isDirty && isValid && !isCreating;

  return (
    <div className="flex justify-center w-full md:py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{TEXTS.post.form.create.title}</CardTitle>
          <CardDescription>
            {TEXTS.post.form.create.description1}
            <br />
            {TEXTS.post.form.create.description2}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormProvider {...form}>
            <form onSubmit={onSubmit} className="space-y-4 md:space-y-6" noValidate>
              <FormInput
                name="url"
                label="URL"
                placeholder={TEXTS.post.form.create.urlPlaceholder}
                required
                disabled={isCreating}
              />
              <FormInput
                name="title"
                label={TEXTS.post.form.create.titleLabel}
                placeholder={TEXTS.post.form.create.titlePlaceholder}
                disabled={isCreating}
              />
              <FormCheckboxGroup
                name="categoryIds"
                label={TEXTS.post.form.create.categoryLabel}
                options={categoryOptionList ?? []}
                disabled={isCreating}
              />

              <div className="pt-2">
                <FormCheckbox
                  name="isPrivate"
                  label={TEXTS.post.form.create.privateLabel}
                  description={TEXTS.post.form.create.privateDescription}
                  disabled={isCreating}
                />
              </div>

              <TooltipWrapper
                content={
                  !isDirty
                    ? TEXTS.validation.urlRequired
                    : !isValid
                      ? TEXTS.validation.urlFormat
                      : null
                }
                className="w-full"
              >
                <Button className="w-full h-11 text-base" disabled={!canSubmit}>
                  {isCreating ? TEXTS.common.submitting : TEXTS.post.form.create.submit}
                </Button>
              </TooltipWrapper>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}
