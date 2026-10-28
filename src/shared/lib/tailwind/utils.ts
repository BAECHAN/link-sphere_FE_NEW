import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// globals.css @theme의 글자 크기 토큰. tailwind-merge 기본 설정은 xs~9xl만 글자 크기로 알아 이 토큰들을 글자 색으로
// 분류한다 — 그러면 같이 쓴 색 클래스(text-muted-foreground)를 지우고 컴포넌트 기본 크기(text-sm)는 남겨 토큰 크기가
// 무시된다(2026-10-28 운영 실측: 모바일 좋아요·댓글 버튼이 11px 대신 14px, 댓글 버튼 회색이 검정).
// 토큰을 추가하면 여기에도 넣는다 — utils.test.ts가 globals.css와 대조한다
const TEXT_SIZE_TOKENS = [
  't1',
  't2',
  't3',
  't4',
  't5',
  't6',
  't7',
  't8',
  't9',
  't10',
  't11',
  't12',
  't13',
  't14',
  'screen-title',
  'section-title',
  'subsection-title',
  'micro',
  'card-title',
  'group-label',
  'display-title',
  'detail-title',
];

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: TEXT_SIZE_TOKENS,
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
