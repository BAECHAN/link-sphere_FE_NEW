import { Post } from '@/entities/post/model/post.schema';
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/atoms/card';
import { Badge } from '@/shared/ui/atoms/badge';
import { Button } from '@/shared/ui/atoms/button';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Lightbulb,
  Lock,
  Unlock,
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
import { BookmarkPostButton } from '@/features/post/bookmark/ui/BookmarkPostButton';
import { TEXTS } from '@/shared/config/texts';
import { usePostCard } from '@/widgets/post/post-card/hooks/usePostCard';

interface PostCardProps {
  post: Post;
  isDetail?: boolean;
}

export function PostCard({ post, isDetail = false }: PostCardProps) {
  const { author } = post;

  const {
    isOwner,
    isUpdatingVisibility,
    isAiSummaryExpanded,
    setIsAiSummaryExpanded,
    isMenuOpen,
    setIsMenuOpen,
    handleDelete,
    handleToggleVisibility,
    handleCopyLink,
    handleNavigateToEdit,
  } = usePostCard(post, isDetail);

  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="p-3 pb-1 flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <UserAvatar
              image={author?.image}
              nickname={author?.nickname}
              size="sm"
              className="flex"
            />
            <span className={`truncate`}>{author?.nickname || TEXTS.post.card.anonymous}</span>
            <span className={`text-xs`}>•</span>
            <span className={`text-xs`}>{DateUtil.formatRelativeShort(post.createdAt)}</span>
          </div>
          <Link to={`/post/${post.id}`} className="hover:underline block">
            <h3 className={`font-bold leading-tight line-clamp-2 mb-0.5 text-sm md:text-lg`}>
              {post.title}
            </h3>
          </Link>
        </div>

        <div className={`flex items-center gap-0.5 md:gap-1 shrink-0`}>
          {isOwner && post.isPrivate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8"
              onClick={handleToggleVisibility}
              disabled={isUpdatingVisibility}
              title={post.isPrivate ? TEXTS.post.card.makePublic : TEXTS.post.card.makePrivate}
            >
              <Lock className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </Button>
          )}

          {isOwner && (
            <DropdownMenu modal={false} open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8">
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
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0 flex flex-col">
        {post.description && (
          <p className={`text-sm text-muted-foreground mb-2 ${isDetail ? '' : 'line-clamp-3'}`}>
            {post.description}
          </p>
        )}

        {post.aiSummary && (
          <div className={`mb-2 bg-info/10 border border-info/20 rounded-md overflow-hidden block`}>
            <button
              onClick={() => setIsAiSummaryExpanded(!isAiSummaryExpanded)}
              className="w-full flex items-center justify-between p-2 hover:bg-info/15 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lightbulb className="h-3 w-3 md:h-4 md:w-4 text-info" />
                <span className="text-xs font-semibold text-info">{TEXTS.post.card.aiSummary}</span>
              </div>
              {isAiSummaryExpanded ? (
                <ChevronUp className="h-3 w-3 text-info" />
              ) : (
                <ChevronDown className="h-3 w-3 text-info" />
              )}
            </button>
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
          className={`block group border rounded-lg overflow-hidden hover:border-primary/50 transition-colors mt-1`}
        >
          {post.ogImage && (
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              <img
                src={post.ogImage}
                alt={post.title}
                className="object-cover group-hover:scale-105 transition-transform duration-300 w-full h-full"
              />
            </div>
          )}
          <div className="p-2 md:p-3 bg-muted/30 flex items-center justify-between group-hover:bg-muted/50 transition-colors">
            <span className="text-xs md:text-sm text-muted-foreground truncate flex-1 pr-2 md:pr-4">
              {post.url}
            </span>
            <div className="flex items-center gap-1 text-xs font-medium text-primary shrink-0">
              <span className="hidden md:inline">{TEXTS.post.card.visitWebsite}</span>
              <ExternalLink className="h-3 w-3" />
            </div>
          </div>
        </a>

        {post.categories && post.categories.length > 0 && (
          <div className={`gap-2 flex-wrap mb-2 mt-3 flex`}>
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
          <div className={`gap-2 flex-wrap mt-2 flex`}>
            {post.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 pt-0 flex gap-2 flex-wrap items-center">
        <div className="flex items-center bg-muted/50 rounded-full p-0.5 md:p-1">
          <LikePostButton
            postId={post.id}
            isLiked={post.userInteractions.isLiked}
            likeCount={post.stats.likeCount}
          />
          <div className="w-px h-3 bg-muted-foreground/20 mx-0.5 md:mx-1" />
          <Link to={`/post/${post.id}`}>
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1 md:gap-1.5 text-muted-foreground h-6 md:h-8 px-2 md:px-3 text-[10px] md:text-sm rounded-full hover:bg-background/80`}
            >
              <MessageSquare className={'h-3 w-3 md:h-4 md:w-4'} />
              <span className={'sm:inline'}>{post.stats.commentCount || 0}</span>
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-1 md:gap-1.5 ml-auto">
          <BookmarkPostButton postId={post.id} isBookmarked={post.userInteractions.isBookmarked} />
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 md:h-9 md:w-9 rounded-full text-muted-foreground`}
            onClick={handleCopyLink}
          >
            <Share2
              className={`h-3.5 w-3.5 md:h-4.5 md:w-4.5 ${post.userInteractions.isBookmarked ? 'fill-current' : ''}`}
            />
            <span className="sr-only">Share</span>
          </Button>
        </div>

        <div className={`items-center gap-1 text-muted-foreground text-xs flex`}>
          <Eye className="h-3 w-3" />
          <span>{post.stats.viewCount || 0}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
