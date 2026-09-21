// entities/bookmark/folder가 참조하는 post의 공개 표면 (FSD @x 표기 — docs/FE-ARCHITECTURE.md 참고)
export { POST_PAGE_SIZE } from '@/entities/post/config/post.const';
export { postInvalidateQueries, postKeys } from '@/entities/post/api/post.keys';
export type { Post, PostListRequest, PostListResponse } from '@/entities/post/model/post.schema';
