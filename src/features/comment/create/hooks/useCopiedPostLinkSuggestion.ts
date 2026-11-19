import { useState } from 'react';
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
  // 입력칸에 포커스한 뒤 아직 글자를 입력하지 않은 동안만 제안한다. 포커스를 잃어도 내리지 않는다 - 제안을
  // 누르면 입력칸이 먼저 포커스를 잃어서, 그때 내리면 클릭이 닿기 전에 제안이 사라진다
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
    insertSuggestedLink,
  };
}
