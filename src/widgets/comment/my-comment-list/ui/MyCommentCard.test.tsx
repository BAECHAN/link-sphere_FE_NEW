import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import dayjs from 'dayjs';
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

  it('코드 블록 안 이미지 주소는 글자로 두고 개수에 세지 않는다', () => {
    renderWithProviders(
      <MyCommentCard comment={buildComment(`\`\`\`\n${IMAGE_A}\n\`\`\`\n\n${IMAGE_B}`)} />
    );

    expect(screen.getByText(/a1b2\.webp/)).toBeInTheDocument();
    expect(screen.queryByText(/c3d4\.png/)).not.toBeInTheDocument();
    expect(screen.getByText(TEXTS.ariaLabels.myCommentImageCount(1))).toBeInTheDocument();
  });

  it('이미지가 없으면 개수 표시를 두지 않는다', () => {
    renderWithProviders(<MyCommentCard comment={buildComment('텍스트만 있는 댓글')} />);

    expect(screen.getByText('텍스트만 있는 댓글')).toBeInTheDocument();
    expect(screen.queryByText(/첨부 이미지/)).not.toBeInTheDocument();
  });
});

function changeVisibility(visibilityState: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visibilityState);
  document.dispatchEvent(new Event('visibilitychange'));
}

// 탭을 열어 둔 채 시간이 지나면 작성 시각 글자가 새로고침 없이 따라 바뀐다(RelativeTime.tsx)
describe('MyCommentCard 작성 시각', () => {
  const WRITTEN_AT = buildComment('').createdAt;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(dayjs(WRITTEN_AT).valueOf());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('열어 둔 채 5분이 지나면 "방금 전"이 "5분 전"으로 바뀐다', () => {
    renderWithProviders(<MyCommentCard comment={buildComment('시간이 지나는 댓글')} />);

    expect(screen.getByText('방금 전')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(screen.getByText('5분 전')).toBeInTheDocument();
  });

  it('탭이 숨겨진 채 18시간이 지난 뒤 다시 보이면 바로 "18시간 전"으로 바뀐다', () => {
    renderWithProviders(<MyCommentCard comment={buildComment('오래 열어 둔 댓글')} />);

    expect(screen.getByText('방금 전')).toBeInTheDocument();

    act(() => {
      changeVisibility('hidden');
    });

    // 타이머는 돌리지 않고 시계만 옮긴다 - 숨겨진 동안에는 다시 그리지 않는다
    vi.setSystemTime(dayjs(WRITTEN_AT).add(18, 'hour').valueOf());

    act(() => {
      changeVisibility('visible');
    });

    expect(screen.getByText('18시간 전')).toBeInTheDocument();
  });
});
