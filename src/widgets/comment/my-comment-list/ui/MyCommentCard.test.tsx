import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import type { MyComment } from '@/entities/comment/model/comment.schema';
import { MyCommentCard } from '@/widgets/comment/my-comment-list/ui/MyCommentCard';

const IMAGE_A = 'https://xyz.supabase.co/storage/v1/object/public/comment-images/a1b2.webp';
const IMAGE_B = 'https://xyz.supabase.co/storage/v1/object/public/comment-images/c3d4.png';

function buildComment(content: string): MyComment {
  return {
    id: 'comment-1',
    postId: 'post-1',
    postTitle: '원글 제목',
    content,
    createdAt: '2026-10-02T00:00:00Z',
  };
}

// BE는 첨부 이미지를 본문 끝에 "한 줄에 URL 하나"로 이어 붙여 저장한다(CommentService.buildFinalContent)
describe('MyCommentCard', () => {
  it('텍스트와 이미지가 함께 있으면 텍스트만 보여주고 이미지 주소는 노출하지 않는다', () => {
    renderWithProviders(
      <MyCommentCard comment={buildComment(`좋은 글이네요\n\n${IMAGE_A}\n${IMAGE_B}`)} />
    );

    expect(screen.getByText('좋은 글이네요')).toBeInTheDocument();
    expect(screen.queryByText(/supabase\.co/)).not.toBeInTheDocument();
    expect(screen.getByText(TEXTS.ariaLabels.myCommentImageCount(2))).toBeInTheDocument();
  });

  it('이미지만 있으면 본문 자리에 사진 개수 문구를 보여준다', () => {
    renderWithProviders(<MyCommentCard comment={buildComment(IMAGE_A)} />);

    expect(screen.getByText(TEXTS.comment.myList.imageOnly(1))).toBeInTheDocument();
    expect(screen.queryByText(/supabase\.co/)).not.toBeInTheDocument();
  });

  it('이미지가 없으면 개수 표시를 두지 않는다', () => {
    renderWithProviders(<MyCommentCard comment={buildComment('텍스트만 있는 댓글')} />);

    expect(screen.getByText('텍스트만 있는 댓글')).toBeInTheDocument();
    expect(screen.queryByText(/첨부 이미지/)).not.toBeInTheDocument();
  });
});
