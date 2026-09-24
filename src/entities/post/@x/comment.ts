// entities/comment가 참조하는 post의 공개 표면 (FSD @x 표기 — docs/FE-ARCHITECTURE.md 참고)
export { postInvalidateQueries } from '@/entities/post/api/post.keys';
export type { Post } from '@/entities/post/model/post.schema';
