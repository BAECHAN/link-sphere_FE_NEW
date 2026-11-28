// 생성 파일 - 직접 고치지 않는다.
// 원본: packages/ui/tokens/*.tokens.json, 다시 만들기: 저장소 루트에서 pnpm tokens
// 값과 이유를 정리한 표: docs/DESIGN-TOKENS.md

/** button 부품 토큰을 Tailwind 클래스로 굳힌 것. 부품의 cva가 읽는다 */
export const BUTTON_RECIPE = {
  base: "rounded-md text-[0.875rem] leading-[1.25rem] font-medium gap-2 [&_svg:not([class*='size-'])]:size-4 disabled:opacity-50",
  variant: {
    default: 'bg-bg-brand-solid hover:bg-bg-brand-solid/90 text-fg-on-brand-solid',
    destructive:
      'bg-bg-critical-solid dark:bg-bg-critical-solid/60 hover:bg-bg-critical-solid/90 dark:hover:bg-bg-critical-solid/60 text-fg-on-critical-solid focus-visible:ring-stroke-critical-solid/20 dark:focus-visible:ring-stroke-critical-solid/40',
    outline:
      'bg-bg-layer-basement dark:bg-input/30 hover:bg-bg-transparent-pressed dark:hover:bg-input/50 hover:text-accent-foreground border-stroke-neutral-weak dark:border-input border shadow-s1',
    secondary: 'bg-bg-neutral-weak hover:bg-bg-neutral-weak/80 text-secondary-foreground',
    ghost:
      'hover:bg-bg-transparent-pressed dark:hover:bg-bg-transparent-pressed/50 hover:text-accent-foreground',
    link: 'text-fg-brand',
  },
  size: {
    default: 'h-9 px-4 has-[>svg]:px-3 py-2',
    sm: 'h-8 px-3 has-[>svg]:px-2.5 gap-1.5',
    lg: 'h-10 px-6 has-[>svg]:px-4',
    icon: 'size-9',
    'icon-sm': 'size-8',
    'icon-lg': 'size-10',
  },
} as const;
