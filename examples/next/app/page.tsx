import { Button } from '@baechan/ui/atoms/button';

import { Showcase } from './showcase';

// 서버 컴포넌트다. 훅이 없는 부품(Button)은 여기서 바로 그리고, 나머지는 클라이언트 경계(Showcase) 아래에서 그린다
export default function Page() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-screen-title">@baechan/ui 예제 (Next.js + React 19)</h1>
        <p className="text-sm text-muted-foreground">
          저장소 안 공용 UI 패키지를 다른 앱에서 그려 보는 화면이다.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">서버 컴포넌트에서 그린 Button</h2>
        <div>
          <Button variant="outline">서버에서 그림</Button>
        </div>
      </section>

      <Showcase />
    </main>
  );
}
