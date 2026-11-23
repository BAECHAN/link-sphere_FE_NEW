'use client';

import { useTheme } from 'next-themes';

import { Button } from '@baechan/ui/atoms/button';
import { LinkThumbnail } from '@baechan/ui/atoms/link-thumbnail';
import { Spinner } from '@baechan/ui/atoms/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@baechan/ui/atoms/tooltip';
import { TooltipWrapper } from '@baechan/ui/elements/TooltipWrapper';
import { toast } from '@baechan/ui/lib/toast/toast';

const BUTTON_VARIANTS = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
] as const;

// 훅을 쓰는 부품은 모두 이 클라이언트 경계 아래에서 그린다
export function Showcase() {
  const { setTheme } = useTheme();

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">테마</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setTheme('light')}>
            밝게
          </Button>
          <Button variant="secondary" onClick={() => setTheme('dark')}>
            어둡게
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">Button</h2>
        <div className="flex flex-wrap gap-2">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">Spinner</h2>
        <div className="flex items-center gap-2 text-sm">
          <Spinner />
          <span>KO_UI_TEXTS로 넘긴 접근 이름을 읽는다</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">Tooltip · TooltipWrapper</h2>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">툴팁</Button>
            </TooltipTrigger>
            <TooltipContent>패키지 Tooltip이다</TooltipContent>
          </Tooltip>
          <TooltipWrapper content="이유: 아직 누를 수 없다" disabled>
            <Button disabled>비활성 버튼</Button>
          </TooltipWrapper>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">Toaster · toast</h2>
        <div className="flex gap-2">
          <Button onClick={() => toast.success('저장했어요.')}>성공 토스트</Button>
          <Button variant="destructive" onClick={() => toast.error('저장하지 못했어요.')}>
            오류 토스트
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">LinkThumbnail</h2>
        <div className="grid grid-cols-2 gap-4">
          <LinkThumbnail src="/sample-thumbnail.svg" alt="예제 썸네일" />
          <LinkThumbnail src="/missing-thumbnail.png" alt="없는 썸네일" />
        </div>
      </section>
    </>
  );
}
