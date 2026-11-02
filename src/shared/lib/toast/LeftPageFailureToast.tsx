import { toast } from '@/shared/lib/toast/toast';

// 설명이 여러 줄인 토스트라 버튼을 설명 아래 오른쪽으로 내리고 닫기 X는 오른쪽 위, 아이콘은 제목 줄에 맞춘다. 제목은
// 빨강·소제목 굵기로, 설명은 본문색으로 구분한다(근거·미리보기 승인: docs/UNSAVED-CHANGES-GUARD.md §5). sonner는
// 제목·설명·버튼에 자체 CSS(속성 선택자 3개)를 걸어 important로 덮는다 - node_modules/sonner/dist/styles.css:127-199
const CLASS_NAMES = {
  toast: '!grid grid-cols-[auto_minmax(0,1fr)_auto] !items-start gap-x-3 gap-y-3',
  icon: 'col-start-1 row-start-1 mt-0.5',
  content: 'col-start-2 row-start-1 min-w-0',
  title: '!text-subsection-title',
  description: '!text-foreground',
  actionButton: 'col-start-2 col-span-2 row-start-2 justify-self-end !ml-0',
  closeButton: 'col-start-3 row-start-1 !ml-0',
};

interface LeftPageFailureToast {
  /** 폼의 이탈 가드 키 - 같은 폼에서 또 실패하면 이전 토스트를 바꿔 쌓이지 않게 한다 */
  key: string;
  /** 무엇이 실패했는지 */
  title: string;
  /** 이유와 할 일 - 문장마다 줄을 바꿔 한 문장이 두 줄로 쪼개지지 않게 한다 */
  description: string;
  /** 그 폼으로 돌아가는 버튼 - 돌아가도 다시 실패할 때(삭제된 글 등)는 넘기지 않는다 */
  action?: { label: string; onClick: () => void };
}

/**
 * 저장 요청 중 "나가기"로 떠난 뒤 실패한 것을 옮겨 간 화면에 알린다. 실패를 알 수 있는 곳이 이 토스트뿐이라
 * 저절로 사라지지 않고 닫기 X나 버튼을 누를 때까지 남는다(WCAG 2.2.1 이해 문서 등, docs/UNSAVED-CHANGES-GUARD.md §5).
 */
export function showLeftPageFailureToast({
  key,
  title,
  description,
  action,
}: LeftPageFailureToast) {
  toast.error(title, {
    id: `left-page-failure:${key}`,
    // 마침표 뒤 공백에서 나눈다. lookbehind(`(?<=\.)`)는 빌드 타깃 safari14(vite.config.ts)가 지원하지 않아
    // esbuild가 new RegExp로 남기고, Safari 16.4 미만에서 SyntaxError가 난다(https://caniuse.com/js-regexp-lookbehind)
    description: description
      .replace(/\.\s+/g, '.\n')
      .split('\n')
      .map((sentence) => (
        <span key={sentence} className="block">
          {sentence}
        </span>
      )),
    duration: Infinity,
    classNames: CLASS_NAMES,
    ...(action && { action }),
  });
}
