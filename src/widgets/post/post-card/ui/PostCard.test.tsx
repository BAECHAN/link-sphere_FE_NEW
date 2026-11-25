import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { TooltipProvider } from '@baechan/ui/atoms/tooltip';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import type { Post } from '@/entities/post/model/post.dto';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';

// 목록 카드는 BE가 줄여 둔 사본(가로 960px 안팎)을, 상세 카드는 원본을 그린다(docs/plans/2026-11-25-og-thumbnail.md "쓰는 곳")
describe('PostCard - 썸네일 주소', () => {
  const OG_IMAGE = 'https://example.com/og.png';
  const THUMBNAIL = 'https://linksphere.click/og-thumbnails/post-uuid-1-0123456789ab.jpg';

  function renderCard(post: Post, isDetail = false) {
    // renderWithProviders에는 TooltipProvider가 없다 - 카드의 TooltipWrapper가 요구해 직접 감싼다
    renderWithProviders(
      <TooltipProvider>
        <PostCard post={post} isDetail={isDetail} />
      </TooltipProvider>
    );

    return screen.getByAltText(post.title);
  }

  it('목록 카드는 줄인 사본이 있으면 사본을 그린다', () => {
    const thumbnail = renderCard({ ...mockPost, ogImage: OG_IMAGE, ogImageThumbnail: THUMBNAIL });

    expect(thumbnail).toHaveAttribute('src', THUMBNAIL);
  });

  it('목록 카드는 사본이 없으면 원본을 그린다', () => {
    const thumbnail = renderCard({ ...mockPost, ogImage: OG_IMAGE, ogImageThumbnail: null });

    expect(thumbnail).toHaveAttribute('src', OG_IMAGE);
  });

  it('상세 카드는 사본이 있어도 원본을 그린다', () => {
    const thumbnail = renderCard(
      { ...mockPost, ogImage: OG_IMAGE, ogImageThumbnail: THUMBNAIL },
      true
    );

    expect(thumbnail).toHaveAttribute('src', OG_IMAGE);
  });
});
