import { MyCommentList } from '@/widgets/comment/my-comment-list/ui/MyCommentList';
import { TEXTS } from '@/shared/config/texts';

export function MyCommentPage() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <h1 className="text-screen-title">{TEXTS.comment.myList.pageTitle}</h1>
      <MyCommentList />
    </div>
  );
}
