import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

// 생성 / 수정
export const createBookmarkFolderSchema = z.object({
  name: z.string().min(1, TEXTS.validation.folderNameRequired),
});

// 폴더 페이지 조회용 sort
export const bookmarkFolderSortEnum = z.enum(['latest', 'oldest', 'title', 'views', 'viewed']);

// folderKey: 'all' | 'uncategorized' | UUID
export type BookmarkFolderKey = 'all' | 'uncategorized' | (string & {});

export type CreateBookmarkFolderRequest = z.infer<typeof createBookmarkFolderSchema>;
export type UpdateBookmarkFolderRequest = z.infer<typeof createBookmarkFolderSchema>;
export type BookmarkFolderSort = z.infer<typeof bookmarkFolderSortEnum>;

// 기존 import 경로 호환 — 응답 타입은 dto.ts(BE 스펙 생성)에서 가져간다.
export type {
  BookmarkFolder,
  BookmarkFolderListResponse,
  BookmarkFoldersResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.dto';
