import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { Label } from '@/shared/ui/atoms/label';
import { Button } from '@/shared/ui/atoms/button';
import { useCreatePost } from '@/domains/post/features/create-post/hooks/useCreatePost';
import { FormProvider } from 'react-hook-form';
import { FormInput } from '@/shared/ui/elements/FormInput';
import { FormCheckboxGroup } from '@/shared/ui/elements/FormCheckboxGroup';
import { useFetchCategoryOptionQuery } from '@/shared/api/common.queries';

export function CreatePostForm() {
  const { form, onSubmit, isCreating } = useCreatePost();
  const { data: categoryOptionList } = useFetchCategoryOptionQuery();

  const {
    formState: { isDirty, isValid },
  } = form;

  return (
    <div className="flex justify-center w-full py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="p-6">
          <CardTitle className="text-2xl">링크 공유하기</CardTitle>
          <CardDescription>
            팀원들과 공유하고 싶은 유용한 아티클이나 리소스의 URL을 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <FormProvider {...form}>
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>URL</Label>
                <FormInput
                  name="url"
                  placeholder="https://example.com/amazing-article"
                  required
                  disabled={isCreating}
                  className="h-11"
                />
                <p className="text-sm text-muted-foreground">
                  자동으로 제목과 이미지를 가져오고 태그를 생성합니다.
                </p>
              </div>

              <div className="space-y-3">
                <Label>관심 분야 (선택사항)</Label>
                <FormCheckboxGroup
                  name="categoryIds"
                  options={categoryOptionList ?? []}
                  disabled={isCreating}
                />
              </div>

              <Button
                disabled={!isDirty || !isValid || isCreating}
                className="w-full h-11 text-base"
              >
                {isCreating ? '공유하는 중...' : '링크 공유하기'}
              </Button>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}
