import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { FormProvider } from 'react-hook-form';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { FormCheckboxGroup } from '@/shared/ui/elements/form/FormCheckboxGroup';
import { FormCheckbox } from '@/shared/ui/elements/form/FormCheckbox';
import { useCategoryOptions } from '@/entities/category/hooks/useCategoryOptions';
import { useUpdatePost } from '@/features/post/update/hooks/useUpdatePost';
import { CenteredSpinner } from '@/shared/ui/elements/CenteredSpinner';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
import { TEXTS } from '@/shared/config/texts';
import { FormAlert } from '@/shared/ui/elements/FormAlert';
import { LinkPreviewCard } from '@/entities/post/ui/LinkPreviewCard';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { Link } from 'react-router-dom';

interface UpdatePostFormProps {
  postId: string;
}

export function UpdatePostForm({ postId }: UpdatePostFormProps) {
  const {
    form,
    isLoading,
    isUpdating,
    onSubmit,
    submitError,
    linkPreview,
    titleValue,
    showUrlChangedNotice,
    showTitleClearedNotice,
    submitButtonRef,
  } = useUpdatePost(postId);
  const { categoryOptionList } = useCategoryOptions();

  const {
    formState: { isDirty, isValid },
  } = form;

  const canSubmit = isDirty && isValid && !isUpdating;

  if (isLoading) {
    return <CenteredSpinner />;
  }

  return (
    <div className="flex justify-center w-full md:py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{TEXTS.post.form.update.title}</CardTitle>
          <CardDescription>{TEXTS.post.form.update.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormProvider {...form}>
            <form onSubmit={onSubmit} className="space-y-4 md:space-y-6" noValidate>
              <FormInput
                name="url"
                label={TEXTS.post.form.update.urlLabel}
                placeholder={TEXTS.post.form.update.urlPlaceholder}
                description={
                  showUrlChangedNotice ? TEXTS.post.form.update.urlChangedNotice : undefined
                }
                autoComplete="off"
                inputMode="url"
                required
              />
              <LinkPreviewCard state={linkPreview} titleOverride={titleValue} />
              <FormInput
                name="title"
                label={TEXTS.post.form.update.titleLabel}
                placeholder={TEXTS.post.form.update.titlePlaceholder}
                description={
                  showTitleClearedNotice ? TEXTS.post.form.update.titleClearedNotice : undefined
                }
              />
              <FormCheckboxGroup
                name="categoryIds"
                label={TEXTS.post.form.update.categoryLabel}
                options={categoryOptionList}
              />

              <div className="pt-2">
                <FormCheckbox
                  name="isPrivate"
                  label={TEXTS.post.form.update.privateLabel}
                  description={TEXTS.post.form.update.privateDescription}
                />
              </div>

              {submitError && (
                <FormAlert>
                  {submitError.message}
                  {submitError.action === 'checkFeed' && (
                    <>
                      {' '}
                      <Link to={ROUTES_PATHS.POST.ROOT} className="underline underline-offset-2">
                        {TEXTS.messages.error.postSubmit.checkFeed}
                      </Link>
                    </>
                  )}
                </FormAlert>
              )}
              <TooltipWrapper
                content={!isDirty ? TEXTS.validation.noChanges : null}
                disabled={!canSubmit}
                className="w-full"
              >
                <Button
                  ref={submitButtonRef}
                  className="w-full h-11 text-base"
                  disabled={!canSubmit}
                >
                  {isUpdating ? TEXTS.common.updating : TEXTS.post.form.update.update}
                </Button>
              </TooltipWrapper>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}
