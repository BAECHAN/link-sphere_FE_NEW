import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { FormProvider } from 'react-hook-form';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { FormCheckboxGroup } from '@/shared/ui/elements/form/FormCheckboxGroup';
import { FormCheckbox } from '@/shared/ui/elements/form/FormCheckbox';
import { useFetchCategoryOptionQuery } from '@/shared/api/common.queries';
import { useUpdatePost } from '@/features/post/update/hooks/useUpdatePost';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

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
          <CardTitle className="text-2xl">링크 수정하기</CardTitle>
          <CardDescription>제목, 관심 분야, 공개 설정을 수정할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {post && (
            <div className="mb-4 p-3 bg-muted/40 rounded-md text-sm text-muted-foreground truncate">
              {post.url}
            </div>
          )}
          <FormProvider {...form}>
            <form onSubmit={onSubmit} className="space-y-4 md:space-y-6" noValidate>
              <FormInput
                name="title"
                label="제목"
                placeholder="제목을 입력하세요"
                required
                disabled={isUpdating}
              />
              <FormCheckboxGroup
                name="categoryIds"
                label="관심 분야 (선택사항)"
                options={categoryOptionList ?? []}
                disabled={isUpdating}
              />

              <div className="pt-2">
                <FormCheckbox
                  name="isPrivate"
                  label="나만 보기 (비공개)"
                  description="체크하면 팀원들에게 공유되지 않고 나만 볼 수 있는 게시물로 저장됩니다."
                  disabled={isUpdating}
                />
              </div>

              <Button className="w-full h-11 text-base" disabled={!canSubmit}>
                {isUpdating ? '수정하는 중...' : '수정하기'}
              </Button>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}
