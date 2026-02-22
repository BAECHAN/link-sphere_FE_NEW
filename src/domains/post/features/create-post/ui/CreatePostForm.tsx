import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { useCreatePost } from '@/domains/post/features/create-post/hooks/useCreatePost';
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
          <CardTitle className="text-2xl">링크 공유하기</CardTitle>
          <CardDescription>
            {`팀원들과 공유하고 싶은 유용한 아티클이나 리소스의 URL을 입력하세요.`}
            <br />
            {`자동으로 제목과 이미지를 가져오고 태그를 생성합니다.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormProvider {...form}>
            <form onSubmit={onSubmit} className="space-y-4 md:space-y-6" noValidate>
              <FormInput
                name="url"
                label="URL"
                placeholder="https://example.com/amazing-article"
                required
                disabled={isCreating}
              />
              <FormCheckboxGroup
                name="categoryIds"
                label="관심 분야 (선택사항)"
                options={categoryOptionList ?? []}
                disabled={isCreating}
              />

              <div className="pt-2">
                <FormCheckbox
                  name="isPrivate"
                  label="나만 보기 (비공개)"
                  description="체크하면 팀원들에게 공유되지 않고 나만 볼 수 있는 게시물로 저장됩니다."
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
                  {isCreating ? '공유하는 중...' : '링크 공유하기'}
                </Button>
              </TooltipWrapper>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}
