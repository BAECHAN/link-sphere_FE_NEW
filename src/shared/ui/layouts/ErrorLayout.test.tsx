import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';

// 홈으로 가는 동작은 쓰는 쪽이 만들어 넘긴다 - 이 부품은 라우터를 모르므로 모두 라우터 없이 그린다.
// 페이지가 넘기는 링크(경로)는 각 페이지 테스트(NotFoundPage.test.tsx 등)가 본다.
describe('ErrorLayout 홈 동작', () => {
  it('homeAction으로 넘긴 링크를 그대로 그린다', () => {
    render(<ErrorLayout title="404" homeAction={<a href="/">홈으로</a>} />);

    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/');
  });

  it('homeAction으로 넘긴 버튼의 동작이 그대로 실행된다', async () => {
    const onHomeClick = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorLayout
        title="500"
        homeAction={
          <button type="button" onClick={onHomeClick}>
            홈으로
          </button>
        }
      />
    );

    await user.click(screen.getByRole('button', { name: '홈으로' }));

    expect(onHomeClick).toHaveBeenCalledOnce();
  });

  it('homeAction이 없으면 링크도 버튼도 그리지 않는다', () => {
    render(<ErrorLayout title="오류" />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
