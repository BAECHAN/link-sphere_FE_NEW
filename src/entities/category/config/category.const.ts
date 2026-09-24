/**
 * 카테고리별 배지 색상 클래스.
 *
 * BE 응답(GET /common/category-option)에 color 필드가 없고 카테고리 개수도 가변이라
 * 이름 하드코딩 맵 대신 category.id % 8로 8개 팔레트 중 하나를 배정한다. 값은 완성된
 * 리터럴 클래스 문자열이어야 한다 - `bg-category-${n}`처럼 동적으로 조합하면 Tailwind
 * JIT 스캐너가 정적 문자열만 인식해 유틸리티가 생성되지 않는다
 * (src/shared/ui/tokens/DesignTokens.stories.tsx 상단 주석 참고).
 *
 * 색상 값 자체(라이트: 색/12% 틴트, 다크: 솔리드 L 0.75)는 src/app/globals.css의
 * --category-1~8 토큰 참고. Artifact 미리보기로 사용자 승인:
 * https://claude.ai/artifact/1Gp7sG9rRhhACeicUwZQLi
 *
 * 형태는 STATUS_BANNER_CLASSNAME(src/pages/version/VersionPage.tsx:14-18)과 동일.
 */
export const CATEGORY_COLOR_CLASSNAME: Record<number, string> = {
  0: 'border-transparent bg-category-1 text-category-1-foreground',
  1: 'border-transparent bg-category-2 text-category-2-foreground',
  2: 'border-transparent bg-category-3 text-category-3-foreground',
  3: 'border-transparent bg-category-4 text-category-4-foreground',
  4: 'border-transparent bg-category-5 text-category-5-foreground',
  5: 'border-transparent bg-category-6 text-category-6-foreground',
  6: 'border-transparent bg-category-7 text-category-7-foreground',
  7: 'border-transparent bg-category-8 text-category-8-foreground',
};

export const CATEGORY_COLOR_COUNT = 8;
