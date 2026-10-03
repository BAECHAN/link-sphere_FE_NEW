import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { Button } from '@/shared/ui/atoms/button';
import { useCreatePost } from '@/features/post/create/hooks/useCreatePost';
import { FormProvider } from 'react-hook-form';
import { FormInput } from '@/shared/ui/elements/form/FormInput';
import { FormCheckboxGroup } from '@/shared/ui/elements/form/FormCheckboxGroup';
import { FormCheckbox } from '@/shared/ui/elements/form/FormCheckbox';
import {
  PostCreateBookmarkFolderField,
  type PostCreateFolderSelectRenderProps,
} from '@/features/post/create/ui/PostCreateBookmarkFolderField';
import { useCategoryOptions } from '@/entities/category/hooks/useCategoryOptions';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
import { TEXTS } from '@/shared/config/texts';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { cn } from '@/shared/lib/tailwind/utils';

// BottomTabBar(h-16 + safe-area)와 동일한 기준으로 그 위에 떠 있는다(MobileCommentBar.tsx 참고).
const TAB_BAR_RESERVE = 'calc(4rem + env(safe-area-inset-bottom))';
const TOAST_GAP_PX = 8;

interface CreatePostFormProps {
  /** 북마크 폴더 선택 창을 그리는 함수 - 위층(PostSubmitPage)이 넘긴다 (docs/FE-ARCHITECTURE.md §26) */
  renderFolderSelect: (props: PostCreateFolderSelectRenderProps) => ReactNode;
}

export function CreatePostForm({ renderFolderSelect }: CreatePostFormProps) {
  const { form, onSubmit, isCreating } = useCreatePost();
  const { categoryOptionList } = useCategoryOptions();
  const barRef = useRef<HTMLDivElement>(null);

  const {
    formState: { isDirty, isValid },
  } = form;

  const canSubmit = isDirty && isValid && !isCreating;

  // 모바일 헤더 검색이 열리면 RecentSearchPanel(z-panel)이 화면을 덮는데 이 바도 같은
  // z층이라 DOM 순서만으로 패널 위에 남는다 - MobileCommentBar.tsx와 동일한 이유로 숨긴다.
  const { isOpen: isMobileSearchOpen } = useHistoryOverlay('mobileSearchOpen');

  // 이 바가 탭바 위에 떠 있는 동안 토스트가 그 위로 뜨도록 --toast-offset-bottom을 바
  // 높이만큼 키운다(MobileCommentBar.tsx의 reserveToastSpaceAboveBar와 동일 패턴).
  // 다만 이 바는 데스크톱에서 position:static인 일반 버튼으로 되돌아가 탭바 위에 뜨지
  // 않으므로, matchMedia로 모바일일 때만 오프셋을 올린다(AppLayout.tsx의
  // blockBackgroundDuringMobileSearch와 같은 md 경계 판정).
  useLayoutEffect(
    function reserveToastSpaceAboveBar() {
      const node = barRef.current;

      if (!node) {
        return;
      }

      const desktop = window.matchMedia('(min-width: 768px)');

      // 창 너비가 md 경계를 오가는 경우까지 매번 다시 판정한다 - desktop.matches를
      // 안 보고 무조건 재계산하면 데스크톱으로 넓혔을 때도 모바일 값이 남는다.
      function syncOffset() {
        if (desktop.matches || isMobileSearchOpen) {
          document.documentElement.style.removeProperty('--toast-offset-bottom');
          return;
        }

        document.documentElement.style.setProperty(
          '--toast-offset-bottom',
          `calc(${TAB_BAR_RESERVE} + ${node!.offsetHeight + TOAST_GAP_PX}px)`
        );
      }

      syncOffset();

      const observer = new ResizeObserver(syncOffset);
      observer.observe(node);
      desktop.addEventListener('change', syncOffset);

      return () => {
        observer.disconnect();
        desktop.removeEventListener('change', syncOffset);
        document.documentElement.style.removeProperty('--toast-offset-bottom');
      };
    },
    [isMobileSearchOpen]
  );

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
                autoComplete="off"
                inputMode="url"
                required
              />
              <FormInput
                name="title"
                label={TEXTS.post.form.create.titleLabel}
                placeholder={TEXTS.post.form.create.titlePlaceholder}
              />
              <FormCheckboxGroup
                name="categoryIds"
                label={TEXTS.post.form.create.categoryLabel}
                options={categoryOptionList}
              />

              <PostCreateBookmarkFolderField renderFolderSelect={renderFolderSelect} />

              <div className="pt-2">
                <FormCheckbox
                  name="isPrivate"
                  label={TEXTS.post.form.create.privateLabel}
                  description={TEXTS.post.form.create.privateDescription}
                />
              </div>

              <div
                ref={barRef}
                className={cn(
                  'fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-panel border-t bg-background px-4 py-2',
                  'md:static md:border-0 md:bg-transparent md:p-0',
                  isMobileSearchOpen && 'hidden'
                )}
              >
                <TooltipWrapper
                  content={
                    !isDirty
                      ? TEXTS.validation.urlRequired
                      : !isValid
                        ? TEXTS.validation.urlFormat
                        : null
                  }
                  disabled={!canSubmit}
                  className="w-full"
                >
                  <Button className="w-full h-11 text-base" disabled={!canSubmit}>
                    {isCreating ? TEXTS.common.submitting : TEXTS.post.form.create.submit}
                  </Button>
                </TooltipWrapper>
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}
