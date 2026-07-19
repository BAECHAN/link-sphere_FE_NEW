import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

// 폴더 항목 — BE FolderResponse 와 매핑
export const folderSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().int().nonnegative(),
  bookmarkCount: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const folderListSchema = z.array(folderSchema);

// 폴더 목록 응답 — BE FolderListResponse 와 매핑 (folders + 미분류 개수)
export const folderListResponseSchema = z.object({
  folders: folderListSchema,
  uncategorizedCount: z.number().int().nonnegative(),
});

// 생성 / 수정
export const createFolderSchema = z.object({
  name: z.string().min(1, TEXTS.validation.folderNameRequired),
});

export const updateFolderSchema = createFolderSchema;

// 순서 재정렬 — 본인 모든 폴더 ID 를 새 순서대로
export const reorderFoldersSchema = z.object({
  folderIds: z.array(z.string()).min(1),
});

// 북마크 폴더 이동 — folderId null = 미분류
export const moveBookmarkSchema = z.object({
  folderId: z.string().nullable(),
});

// 폴더 페이지 조회용 sort
export const folderSortEnum = z.enum(['latest', 'oldest', 'title', 'views']);

// folderKey: 'all' | 'uncategorized' | UUID
export type FolderKey = 'all' | 'uncategorized' | (string & {});

export type Folder = z.infer<typeof folderSchema>;
export type FolderList = z.infer<typeof folderListSchema>;
export type FolderListResponse = z.infer<typeof folderListResponseSchema>;
export type CreateFolderRequest = z.infer<typeof createFolderSchema>;
export type UpdateFolderRequest = z.infer<typeof updateFolderSchema>;
export type ReorderFoldersRequest = z.infer<typeof reorderFoldersSchema>;
export type MoveBookmarkRequest = z.infer<typeof moveBookmarkSchema>;
export type FolderSort = z.infer<typeof folderSortEnum>;
