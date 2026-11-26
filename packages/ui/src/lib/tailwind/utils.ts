import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { DURATION_TOKEN_NAMES, EASE_TOKEN_NAMES, TEXT_SIZE_TOKEN_NAMES } from '@baechan/ui/tokens';

// 글자 크기 토큰(눈금 t1~t14와 역할 토큰)을 글자 크기로 등록한다. tailwind-merge 기본 설정은 xs~9xl만 글자 크기로 알아
// 이 토큰들을 글자 색으로 분류한다 — 그러면 같이 쓴 색 클래스(text-muted-foreground)를 지우고 컴포넌트 기본 크기(text-sm)는
// 남겨 토큰 크기가 무시된다(2026-10-28 운영 실측: 모바일 좋아요·댓글 버튼이 11px 대신 14px, 댓글 버튼 회색이 검정).
// 시간·곡선 토큰도 등록한다. tailwind-merge 3.7.0은 시간은 숫자, 곡선은 in·out·in-out 이름만 알아, 등록하지 않으면 쓰는
// 쪽이 넘긴 duration-d6이 부품의 duration-d4를 지우지 못하고 둘 다 남는다.
// 이름은 토큰 원본에서 만든 목록을 읽는다 — 원본에 토큰을 더하고 `pnpm tokens`를 돌리면 함께 등록된다(utils.test.ts가 확인)
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...TEXT_SIZE_TOKEN_NAMES],
      ease: [...EASE_TOKEN_NAMES],
    },
    classGroups: {
      duration: [{ duration: [...DURATION_TOKEN_NAMES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
