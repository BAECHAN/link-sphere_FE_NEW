import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@baechan/ui/lib/tailwind/utils';
import { BUTTON_RECIPE } from '@baechan/ui/recipes/button.recipe.gen';
import { forwardRef } from 'react';

// 버튼만의 결정(변형·크기별 색, 높이, 여백, 글자)은 부품 토큰(packages/ui/tokens/components/button.tokens.json)에서
// 만든 BUTTON_RECIPE가 갖는다. 여기에는 배치와, 입력칸 등 다른 부품과 함께 쓰는 포커스·오류 표시만 둔다
// (2026-11-28 게이트 4, docs/DESIGN-SYSTEM.md §5 "부품 토큰").
const buttonVariants = cva(
  `inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-stroke-focus-ring focus-visible:ring-stroke-focus-ring/50 focus-visible:ring-[3px] aria-invalid:ring-stroke-critical-solid/20 dark:aria-invalid:ring-stroke-critical-solid/40 aria-invalid:border-stroke-critical-solid ${BUTTON_RECIPE.base}`,
  {
    variants: {
      variant: {
        default: BUTTON_RECIPE.variant.default,
        destructive: BUTTON_RECIPE.variant.destructive,
        outline: BUTTON_RECIPE.variant.outline,
        secondary: BUTTON_RECIPE.variant.secondary,
        ghost: BUTTON_RECIPE.variant.ghost,
        link: `${BUTTON_RECIPE.variant.link} underline-offset-4 hover:underline`,
        // 호버 스타일이 전혀 없는 variant. 배경·글자색을 호출부가 전부 정하는
        // 컴포넌트(FilterChip 등)를 위한 것이다 — ghost를 쓰면 호출부의
        // `hover:bg-X`가 twMerge로 ghost의 호버 배경만 지우고 다크 호버 배경은
        // modifier 그룹(`dark:hover:` vs `hover:`)이 달라 그대로 남아, 다크모드에서만
        // 호버 시 색이 덮인다(2026-09-21 실측). 부품 토큰이 없는 자리라 레시피에도 없다.
        // 값이 빈 문자열이라 variant 슬롯만 비고, base 클래스(레이아웃·포커스 링·
        // disabled 처리)는 그대로 적용된다.
        none: '',
      },
      size: BUTTON_RECIPE.size,
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
