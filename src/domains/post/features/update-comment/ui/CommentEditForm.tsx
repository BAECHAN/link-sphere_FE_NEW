import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { X, Check } from 'lucide-react';
import { MarkdownContent } from '@/domains/post/_common/ui/MarkdownContent';

interface CommentEditFormProps {
  editContent: string;
  editImagePreviewUrl: string | null;
  isUpdating: boolean;
  canSubmit: boolean;
  isMobile: boolean;
  setEditContent: (content: string) => void;
  cancelEditing: () => void;
  handleEditPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  clearEditImage: () => void;
  handleUpdate: () => void;
}

export function CommentEditForm({
  editContent,
  editImagePreviewUrl,
  isUpdating,
  canSubmit,
  isMobile,
  setEditContent,
  cancelEditing,
  handleEditPaste,
  clearEditImage,
  handleUpdate,
}: CommentEditFormProps) {
  return (
    <div className="space-y-2">
      <Textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        className="min-h-[80px] text-sm"
        placeholder="수정할 내용을 입력하세요... (이미지 복사+붙여넣기 가능)"
        autoFocus
        onPaste={handleEditPaste}
      />
      {editContent && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1.5">미리보기</p>
          <MarkdownContent content={editContent} isMobile={isMobile} />
        </div>
      )}
      {editImagePreviewUrl && (
        <div className="relative inline-block border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden group">
          <img src={editImagePreviewUrl} alt="Pasted preview" className="max-h-32 object-contain" />
          <button
            type="button"
            onClick={clearEditImage}
            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title="이미지 삭제"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={cancelEditing}
          className="h-8 px-2 text-xs"
        >
          <X className="mr-1 h-3 w-3" />
          취소
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleUpdate}
          disabled={!canSubmit}
          className="h-8 px-2 text-xs"
        >
          <Check className="mr-1 h-3 w-3" />
          {isUpdating ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}
