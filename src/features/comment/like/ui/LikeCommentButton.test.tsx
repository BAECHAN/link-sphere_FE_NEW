import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { LikeCommentButton } from '@/features/comment/like/ui/LikeCommentButton';

function renderButton(isLiked: boolean, likeCount: number) {
  renderWithProviders(
    <LikeCommentButton
      commentId="comment-1"
      postId="post-1"
      isLiked={isLiked}
      likeCount={likeCount}
    />
  );
}

describe('LikeCommentButton — 접근 이름', () => {
  it('숫자만 보여도 무슨 버튼인지 읽는다', () => {
    renderButton(false, 3);

    expect(
      screen.getByRole('button', { name: TEXTS.ariaLabels.likeWithCount(3) })
    ).toHaveTextContent('3');
  });

  it('눌렀으면 취소 동작과 수를 읽는다', () => {
    renderButton(true, 3);

    expect(
      screen.getByRole('button', { name: TEXTS.ariaLabels.unlikeWithCount(3) })
    ).toBeInTheDocument();
  });

  it('0개면 화면에는 글자가 보이고 이름에는 수까지 읽는다', () => {
    renderButton(false, 0);

    expect(
      screen.getByRole('button', { name: TEXTS.ariaLabels.likeWithCount(0) })
    ).toHaveTextContent(TEXTS.comment.item.like);
  });
});
