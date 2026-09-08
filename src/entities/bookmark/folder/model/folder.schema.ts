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
  // 이 폴더에 마지막으로 저장한 시각 — 한 번도 저장 안 됐으면 null.
  // z.null()이 먼저 와야 한다: z.union은 순서대로 시도해 먼저 성공하는 쪽을 쓰는데,
  // z.coerce.date()가 앞에 있으면 new Date(null)이 1970-01-01로 "성공"해버려서
  // z.null() 분기까지 가지도 못한 채 "미사용 폴더"가 최근성 계산에 잘못 섞여 들어간다.
  // .optional()은 구 BE 응답과의 호환용.
  lastUsedAt: z.union([z.null(), z.coerce.date()]).optional(),
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

// 소속 변경 API(추가/제거/전체해제) 공통 응답 — 변경 후 권위 상태를 그대로 반환한다
export const bookmarkFoldersResponseSchema = z.object({
  postId: z.string(),
  isBookmarked: z.boolean(),
  folderIds: z.array(z.string()),
});

// 폴더 페이지 조회용 sort
export const folderSortEnum = z.enum(['latest', 'oldest', 'title', 'views', 'viewed']);

// folderKey: 'all' | 'uncategorized' | UUID
export type FolderKey = 'all' | 'uncategorized' | (string & {});

export type Folder = z.infer<typeof folderSchema>;
export type FolderList = z.infer<typeof folderListSchema>;
export type FolderListResponse = z.infer<typeof folderListResponseSchema>;
export type CreateFolderRequest = z.infer<typeof createFolderSchema>;
export type UpdateFolderRequest = z.infer<typeof updateFolderSchema>;
export type ReorderFoldersRequest = z.infer<typeof reorderFoldersSchema>;
export type BookmarkFoldersResponse = z.infer<typeof bookmarkFoldersResponseSchema>;
export type FolderSort = z.infer<typeof folderSortEnum>;
