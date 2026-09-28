import { Button } from '@/shared/ui/atoms/button';
import { Card } from '@/shared/ui/atoms/card';
import { Switch } from '@/shared/ui/atoms/switch';
import { FilterChip } from '@/shared/ui/elements/FilterChip';
import { RotateCcw } from 'lucide-react';
import { usePostListSearch } from '@/widgets/post/post-list/hooks/usePostListSearch';
import { TEXTS } from '@/shared/config/texts';

export function PostListSearch() {
  const {
    categoryOptionList,
    selectedCategories,
    toggleCategoryTagInSearch,
    isClickedBookmark,
    isClickedMyPosts,
    isClickedPrivate,
    handleToggleFilter,
    optimisticHideBots,
    handleToggleHideBots,
    appliedCount,
    handleClearSearch,
  } = usePostListSearch();

  return (
    <Card className="gap-2 md:gap-3 p-4 rounded-2xl hover:shadow-md transition-shadow">
      <div
        role="group"
        aria-label={TEXTS.ariaLabels.postCategoryFilters}
        className="flex flex-wrap gap-2"
      >
        {categoryOptionList.map((category) => {
          const isSelected = selectedCategories.has(category.label);
          return (
            <FilterChip
              key={category.value}
              id={`category-${category.value}`}
              name={category.value}
              label={`@${category.label}`}
              isActive={isSelected}
              activeClassName="bg-primary text-primary-foreground"
              onClick={() => toggleCategoryTagInSearch(category)}
            />
          );
        })}
      </div>

      <div
        role="group"
        aria-label={TEXTS.ariaLabels.postScopeFilters}
        className="flex flex-wrap gap-2"
      >
        <FilterChip
          label={TEXTS.buttons.bookmarkOnly}
          isActive={isClickedBookmark}
          activeClassName="bg-warning text-warning-foreground"
          onClick={() => handleToggleFilter('isBookmarked')}
        />

        <FilterChip
          label={TEXTS.buttons.myPosts}
          isActive={isClickedMyPosts}
          activeClassName="bg-info text-info-foreground"
          onClick={() => handleToggleFilter('isMyPosts')}
        />

        <FilterChip
          label={TEXTS.buttons.privateOnly}
          isActive={isClickedPrivate}
          activeClassName="bg-category text-category-foreground"
          onClick={() => handleToggleFilter('isPrivate')}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* 칩이 아니라 별도 스위치 - 나머지 필터(URL)와 달리 기기별 개인 설정이라
            localStorage(useHideBotsStore)에 영속화한다. 기본 OFF(봇 글 보임).
            초기화 대상이 아니라서(위 appliedCount 계산에서 제외) 오른쪽 카운트+
            초기화 묶음과는 분리해 행의 왼쪽 끝에 둔다. 터치 타깃은 FilterChip과
            같은 28px로 통일(2026-09-06), 텍스트 크기도 옆 "조건 N개 적용 중"과
            맞춰 text-xs로 통일(기존 text-sm은 이 카드에서 유일하게 튀어 보였음). */}
        <label
          htmlFor="hide-bots-switch"
          className="inline-flex items-center gap-2 min-h-7 cursor-pointer select-none text-xs text-muted-foreground"
        >
          <span>{TEXTS.buttons.hideBots}</span>
          <Switch
            id="hide-bots-switch"
            checked={optimisticHideBots}
            onCheckedChange={handleToggleHideBots}
          />
        </label>

        <div className="flex items-center gap-2">
          <span aria-live="polite" className="text-xs text-muted-foreground">
            {appliedCount > 0 ? TEXTS.post.search.appliedCount(appliedCount) : ''}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearSearch}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            {TEXTS.buttons.reset}
          </Button>
        </div>
      </div>
    </Card>
  );
}
