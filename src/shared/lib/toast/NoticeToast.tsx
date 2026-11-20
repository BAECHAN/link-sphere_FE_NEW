import type { ReactNode } from 'react';
import { toast } from '@link-sphere/ui/lib/toast/toast';
import { STACKED_ACTION_CLASS_NAMES } from '@link-sphere/ui/lib/toast/toast-layout';

// 버튼이 없을 때도 같은 틀(닫기 X 오른쪽 위, 아이콘은 제목 줄)을 쓰려고 배치 클래스를 직접 넘긴다. 제목은 종류의
// 색·소제목 굵기로, 설명은 본문색으로 구분한다(근거·미리보기 승인: docs/UNSAVED-CHANGES-GUARD.md §5). sonner는
// 제목·설명에 자체 CSS(속성 선택자)를 걸어 important로 덮는다 - node_modules/sonner/dist/styles.css:127-199
const CLASS_NAMES = {
  ...STACKED_ACTION_CLASS_NAMES,
  title: '!text-subsection-title',
  description: '!text-foreground',
};

type NoticeVariant = 'error' | 'warning' | 'success' | 'info';

// 에러·경고는 읽고 이해할 시간이 필요해 닫기 X나 버튼을 누를 때까지 남는다(Atlassian Flag 지침,
// docs/DECISIONS.md 2026-11-18 "안내 토스트"). 그 밖은 sonner 기본값대로 사라진다
const DEFAULT_DURATION: Partial<Record<NoticeVariant, number>> = {
  error: Infinity,
  warning: Infinity,
};

interface NoticeToast {
  /** 종류 - 기본 아이콘과 제목 색, 지속 시간 기본값을 정한다 */
  variant: NoticeVariant;
  /** 한 줄로 말하는 요점 */
  title: string;
  /** 이유와 할 일 - 문장마다 줄을 바꿔 한 문장이 두 줄로 쪼개지지 않게 한다 */
  description: string;
  /** 종류의 기본 아이콘 대신 쓸 아이콘 */
  icon?: ReactNode;
  /** 사라질 때까지의 시간(ms) - 안 넘기면 에러·경고는 닫을 때까지 남고 그 밖은 sonner 기본값이다 */
  duration?: number;
  /** 같은 id로 또 띄우면 쌓이지 않고 이전 토스트를 바꾼다 */
  id?: string;
  /** 설명 아래 오른쪽 버튼 */
  action?: { label: string; onClick: () => void };
}

/**
 * 제목(종류의 색)·설명(본문색)·버튼(설명 아래)으로 된 안내 토스트. 한 줄 문구로 부족해 무엇이 일어났는지와
 * 이유·할 일을 나눠 말해야 할 때 쓴다(선례: 폼을 떠난 뒤 실패, docs/UNSAVED-CHANGES-GUARD.md §5).
 */
export function showNoticeToast({
  variant,
  title,
  description,
  icon,
  duration = DEFAULT_DURATION[variant],
  id,
  action,
}: NoticeToast) {
  toast[variant](title, {
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
    UNSAFE_classNames: CLASS_NAMES,
    ...(id !== undefined && { id }),
    ...(icon !== undefined && { icon }),
    ...(duration !== undefined && { duration }),
    ...(action && { action }),
  });
}
