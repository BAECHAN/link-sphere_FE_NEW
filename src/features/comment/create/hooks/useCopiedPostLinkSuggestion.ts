import { useState, type FocusEvent } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useCopiedPostLinkStore } from '@/shared/store/copiedPostLink.store';

interface UseCopiedPostLinkSuggestionOptions {
  /** 지금 댓글을 쓰는 글 - 이 글 자신의 링크는 제안하지 않는다 */
  postId: string;
  form: UseFormReturn<{ content: string }>;
  contentValue: string;
}

/**
 * 글 카드의 공유 버튼으로 복사해 둔 다른 글의 링크를 빈 댓글 입력칸에 넣어 주는 제안(docs/COMMENT.md §5).
 * 클립보드는 읽지 않고, 앱이 직접 복사하며 기억해 둔 링크(useCopiedPostLinkStore)만 쓴다.
 */
export function useCopiedPostLinkSuggestion({
  postId,
  form,
  contentValue,
}: UseCopiedPostLinkSuggestionOptions) {
  const copiedPostLink = useCopiedPostLinkStore((state) => state.copiedPostLink);
  const clearCopiedPostLink = useCopiedPostLinkStore((state) => state.clearCopiedPostLink);
  // 입력칸에 포커스한 뒤 아직 글자를 입력하지 않았고 포커스가 입력칸·제안 밖으로 나가지 않은 동안만 제안한다
  const [isOffering, setIsOffering] = useState(false);

  const isOtherPostLink = copiedPostLink !== null && copiedPostLink.postId !== postId;
  const suggestedLink = isOffering && !contentValue && isOtherPostLink ? copiedPostLink : null;

  const handleContentFocus = () => {
    setIsOffering(true);
  };

  // 한 번 지나친 제안은 입력칸을 벗어났다 다시 포커스할 때까지 내린다 - 다 지우거나 등록해 빈 칸이 돼도 돌아오지 않는다
  const handleContentInput = () => {
    setIsOffering(false);
  };

  // 입력칸과 제안을 감싼 영역에 단다. React의 onBlur는 버블링해 자식의 포커스 이동이 여기로 온다
  // (https://react.dev/reference/react-dom/components/common#common-props). 포커스가 영역 안(입력칸 → Tab → 제안)에서
  // 옮겨 가면 그대로 두고, 밖(다른 폼·빈 곳·창 전환)으로 나가면 내린다 - 그래야 폼 두 개에 제안이 함께 남지 않는다.
  // 마우스로 제안을 누를 때는 제안의 onMouseDown이 입력칸 포커스를 지켜 여기까지 오지 않는다(CommentForm.tsx)
  const handleSuggestionAreaBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setIsOffering(false);
  };

  const insertSuggestedLink = () => {
    if (!suggestedLink) {
      return;
    }

    // 주소 뒤에 공백을 둔다 - 링크 인식이 공백 전까지를 주소로 봐서(MarkdownContent의 URL_PATTERN) 이어 쓴 글자가 링크에 붙지 않는다
    form.setValue('content', `${suggestedLink.url} `, { shouldDirty: true });
    setIsOffering(false);
    clearCopiedPostLink();
  };

  return {
    suggestedLink,
    handleContentFocus,
    handleContentInput,
    handleSuggestionAreaBlur,
    insertSuggestedLink,
  };
}
