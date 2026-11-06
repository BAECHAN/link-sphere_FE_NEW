import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { LikePostButton } from '@/features/post/like/ui/LikePostButton';

describe('LikePostButton — 접근 이름', () => {
  it('누르지 않았으면 좋아요와 수를 읽는다', () => {
    renderWithProviders(<LikePostButton postId="post-1" isLiked={false} likeCount={3} />);

    expect(
      screen.getByRole('button', { name: TEXTS.ariaLabels.likeWithCount(3) })
    ).toBeInTheDocument();
  });

  it('눌렀으면 취소 동작과 수를 읽는다', () => {
    renderWithProviders(<LikePostButton postId="post-1" isLiked likeCount={3} />);

    expect(
      screen.getByRole('button', { name: TEXTS.ariaLabels.unlikeWithCount(3) })
    ).toBeInTheDocument();
  });

  it('큰 수는 화면에 보이는 축약값 그대로 읽는다', () => {
    renderWithProviders(<LikePostButton postId="post-1" isLiked={false} likeCount={1234} />);

    expect(
      screen.getByRole('button', { name: TEXTS.ariaLabels.likeWithCount('1.2천') })
    ).toHaveTextContent('1.2천');
  });
});
