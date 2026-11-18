import { toast } from '@/shared/lib/toast/toast';
import { STACKED_ACTION_CLASS_NAMES } from '@/shared/lib/toast/toast-layout';

// 버튼이 없을 때도(댓글) 같은 틀(닫기 X 오른쪽 위, 아이콘은 제목 줄)을 쓰려고 배치 클래스를 직접 넘긴다. 제목은
// 빨강·소제목 굵기로, 설명은 본문색으로 구분한다(근거·미리보기 승인: docs/UNSAVED-CHANGES-GUARD.md §5). sonner는
// 제목·설명에 자체 CSS(속성 선택자)를 걸어 important로 덮는다 - node_modules/sonner/dist/styles.css:127-199
const CLASS_NAMES = {
  ...STACKED_ACTION_CLASS_NAMES,
  title: '!text-subsection-title',
  description: '!text-foreground',
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
 * 저장 요청 중 "나가기"로 떠난 뒤(댓글은 폼을 닫은 뒤도) 실패한 것을 옮겨 간 화면에 알린다. 실패를 알 수 있는 곳이
 * 이 토스트뿐이라 저절로 사라지지 않고 닫기 X나 버튼을 누를 때까지 남는다(WCAG 2.2.1 이해 문서 등,
 * docs/UNSAVED-CHANGES-GUARD.md §5).
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
    UNSAFE_classNames: CLASS_NAMES,
    ...(action && { action }),
  });
}
