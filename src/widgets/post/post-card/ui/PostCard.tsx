import { memo } from 'react';
import { Post } from '@/entities/post/model/post.schema';
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/atoms/card';
import { Badge } from '@/shared/ui/atoms/badge';
import { Button } from '@/shared/ui/atoms/button';
import { LinkThumbnail } from '@/shared/ui/atoms/link-thumbnail';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Lightbulb,
  Lock,
  Unlock,
  Loader2,
  MessageSquare,
  Share2,
} from 'lucide-react';
import { UserAvatar } from '@/entities/user/ui/UserAvatar';
import { DateUtil } from '@/shared/utils/date.util';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/atoms/dropdown-menu';
import { MoreVertical, Pencil, Trash } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LikePostButton } from '@/features/post/like/ui/LikePostButton';
import { BookmarkPostButton } from '@/features/bookmark/toggle/ui/BookmarkPostButton';
import { TEXTS } from '@/shared/config/texts';
import { usePostCard } from '@/widgets/post/post-card/hooks/usePostCard';
import { cn } from '@/shared/lib/tailwind/utils';

interface PostCardProps {
  post: Post;
  isDetail?: boolean;
  /**
   * 이 카드가 어느 목록에 있는지 - 상세로 넘어갈 때 history state에 실어 보내
   * 상세의 돌아가기 버튼이 "목록으로"(feed)와 "뒤로가기"(그 외)를 정확히 고르게 한다
   * (PostDetailPage의 resolveBackLabel 참고). 지정하지 않으면 "뒤로가기"로 떨어진다.
   */
  backSource?: 'feed' | 'bookmark';
}

export const PostCard = memo(function PostCard({
  post,
  isDetail = false,
  backSource,
}: PostCardProps) {
  const { author } = post;

  const {
    isOwner,
    isUpdating,
    isUpdatingVisibility,
    isAiSummaryExpanded,
    setIsAiSummaryExpanded,
    isMenuOpen,
    setIsMenuOpen,
    handleDelete,
    handleToggleVisibility,
    handleCopyLink,
    handleCopyOriginalUrl,
    handleNavigateToEdit,
    handlePrefetchDetail,
  } = usePostCard(post, isDetail);

  // 수정 중에는 내용을 흐리게 하고 상호작용을 막아 같은 게시글에 대한 중복 요청을 차단한다
  const dimmedClassName = isUpdating ? 'opacity-40 pointer-events-none' : '';

  return (
    <Card
      className="relative flex flex-col overflow-hidden hover:shadow-md transition-shadow"
      aria-busy={isUpdating}
    >
      {isUpdating && (
        <div className="absolute inset-0 z-raised flex items-center justify-center gap-2 bg-background/60">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{TEXTS.common.updating}</span>
        </div>
      )}

      <CardHeader
        className={cn(
          // 제목이 카드 가로폭을 온전히 쓰도록 2열 그리드로 둔다. 소유자 액션(자물쇠·⋮)은
          // 1행 우측 셀에만 들어간다 - CardAction 슬롯(shared/ui/atoms/card.tsx)은
          // row-span-2라 두 행 모두에 우측 거터를 예약해버려 이 목적엔 쓸 수 없다.
          'p-3 pb-1 grid grid-cols-[1fr_auto] items-start space-y-0',
          dimmedClassName
        )}
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <UserAvatar
            image={author?.image}
            nickname={author?.nickname}
            size="sm"
            className="flex"
            zoomable
          />
          <span className="truncate">{author?.nickname || TEXTS.post.card.anonymous}</span>
          <span className="text-xs shrink-0">•</span>
          <span className="text-xs shrink-0">{DateUtil.formatRelativeShort(post.createdAt)}</span>
        </div>

        {isOwner && (
          // 음수 마진으로 아이콘 버튼(28/32px)이 작성자 행(아바타 24px) 높이를 밀어올려
          // 카드가 커지는 것을 막는다 - 히트 영역은 그대로고 레이아웃 기여분만 줄인다
          <div className="flex items-center gap-0.5 md:gap-1 shrink-0 -my-0.5 md:-my-1">
            {post.isPrivate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:h-8 md:w-8"
                onClick={handleToggleVisibility}
                disabled={isUpdatingVisibility}
                title={TEXTS.post.card.makePublic}
                aria-label={TEXTS.post.card.makePublic}
              >
                <Lock className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
              </Button>
            )}

            <DropdownMenu modal={false} open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 md:h-8 md:w-8"
                  aria-label={TEXTS.ariaLabels.postMenu}
                >
                  <MoreVertical className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigateToEdit();
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {TEXTS.post.card.edit}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleVisibility} disabled={isUpdatingVisibility}>
                  {post.isPrivate ? (
                    <>
                      <Unlock className="mr-2 h-4 w-4" />
                      {TEXTS.post.card.publicLabel}
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      {TEXTS.post.card.privateLabel}
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  {TEXTS.buttons.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <Link
          to={`/post/${post.id}`}
          state={backSource ? { backSource } : undefined}
          className="col-span-2 hover:underline block"
          onMouseEnter={handlePrefetchDetail}
          onFocus={handlePrefetchDetail}
        >
          <h3 className={cn('text-card-title md:text-t6 mb-0.5', !isDetail && 'line-clamp-3')}>
            {post.title}
          </h3>
        </Link>
      </CardHeader>

      <CardContent className={cn('p-3 pt-0 flex flex-col', dimmedClassName)}>
        {post.description && (
          <p className={cn('text-sm text-muted-foreground mb-2', !isDetail && 'line-clamp-3')}>
            {post.description}
          </p>
        )}

        {post.aiSummary && (
          <div className="mb-2 bg-info/10 border border-info/20 rounded-md overflow-hidden block">
            <Button
              type="button"
              variant="none"
              onClick={() => setIsAiSummaryExpanded(!isAiSummaryExpanded)}
              className="w-full flex items-center justify-between h-auto p-2 hover:bg-info/15 transition-colors rounded-none"
            >
              <div className="flex items-center gap-2">
                <Lightbulb className="h-3 w-3 md:h-4 md:w-4 text-info" />
                {/* eslint-disable-next-line custom-tailwind/no-raw-title -- 배지 라벨, 제목 아님 */}
                <span className="text-xs font-semibold text-info">{TEXTS.post.card.aiSummary}</span>
              </div>
              {isAiSummaryExpanded ? (
                <ChevronUp className="h-3 w-3 text-info" />
              ) : (
                <ChevronDown className="h-3 w-3 text-info" />
              )}
            </Button>
            {isAiSummaryExpanded && (
              <div className="p-2 pt-0 border-t border-info/15">
                <p className="text-xs md:text-sm text-foreground/80 leading-relaxed">
                  {post.aiSummary}
                </p>
              </div>
            )}
          </div>
        )}

        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block group border rounded-lg overflow-hidden hover:border-primary/50 transition-colors mt-1"
        >
          <LinkThumbnail
            src={post.ogImage}
            alt={post.title}
            className="group-hover:scale-105 transition-transform duration-300"
          />
          <div className="p-2 md:p-3 bg-muted/30 flex items-center justify-between group-hover:bg-muted/50 transition-colors">
            <span className="text-xs md:text-sm text-muted-foreground truncate flex-1 pr-2 md:pr-4">
              {post.url}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full p-0 text-muted-foreground hover:text-foreground"
                onClick={handleCopyOriginalUrl}
                title={TEXTS.post.card.copyOriginalLink}
              >
                <Copy className="h-3 w-3" />
                <span className="sr-only">{TEXTS.post.card.copyOriginalLink}</span>
              </Button>
            </div>
          </div>
        </a>

        {post.categories && post.categories.length > 0 && (
          <div className="gap-2 flex-wrap mb-2 mt-3 flex">
            {post.categories?.map((category) => (
              <Badge
                key={category?.id}
                variant="default"
                className="text-xs bg-category hover:bg-category/90"
              >
                {category?.name}
              </Badge>
            ))}
          </div>
        )}

        {post.tags && post.tags.length > 0 && (
          <div className="gap-2 flex-wrap mt-2 flex">
            {post.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className={cn('p-3 pt-0 flex gap-2 flex-wrap items-center', dimmedClassName)}>
        <div className="flex items-center bg-muted/50 rounded-full p-0.5 md:p-1">
          <LikePostButton
            postId={post.id}
            isLiked={post.userInteractions.isLiked}
            likeCount={post.stats.likeCount}
          />
          <div className="w-px h-3 bg-muted-foreground/20 mx-0.5 md:mx-1" />
          <Link to={`/post/${post.id}`} state={backSource ? { backSource } : undefined}>
            <Button
              variant="none"
              size="sm"
              className="gap-1 md:gap-1.5 text-muted-foreground h-6 md:h-8 px-2 md:px-3 text-micro md:text-sm rounded-full hover:bg-background/80 hover:text-foreground"
            >
              <MessageSquare className={'h-3 w-3 md:h-4 md:w-4'} />
              <span className={'sm:inline'}>{post.stats.commentCount || 0}</span>
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-1 md:gap-1.5 ml-auto">
          <BookmarkPostButton
            postId={post.id}
            isBookmarked={post.userInteractions.isBookmarked}
            bookmarkFolderIds={post.userInteractions.bookmarkFolderIds}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9 rounded-full text-muted-foreground"
            onClick={handleCopyLink}
          >
            <Share2 className="size-4" />
            <span className="sr-only">Share</span>
          </Button>
        </div>

        <div className="items-center gap-1 md:gap-1.5 text-muted-foreground text-xs flex">
          <Eye className="h-3 w-3" />
          <span>{post.stats.viewCount || 0}</span>
        </div>
      </CardFooter>
    </Card>
  );
});
