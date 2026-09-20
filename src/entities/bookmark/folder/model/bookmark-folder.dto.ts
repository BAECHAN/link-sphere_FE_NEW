import type { components } from '@/shared/api/generated/openapi.gen';

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다. 생성 파일을 직접 import하는 곳은 엔티티당 이 파일
// 하나뿐이라, 스펙 스키마 이름이 바뀌어도 고칠 자리가 한 곳이다.

// BE 스펙은 lastUsedAt이 없으면 키 자체가 생략되는 것처럼(optional) 표기하지만
// (스펙 전체에 nullable 키가 0건 — springdoc이 Kotlin nullable을 required 여부로만
// 반영하고 nullable: true는 안 붙인다), 실제 런타임은 Jackson JsonInclude.ALWAYS라
// 키는 항상 있고 값이 null로 온다 — bookmark-folder.util.ts의 `!== null` 가드가 이미
// 그걸 전제하고 있었다. BE에 ModelConverter를 추가해 스펙 자체를 고치기 전까지(계획의
// Phase 0.5) 여기서 FE 쪽 타입을 실제 런타임에 맞게 넓힌다.
export type BookmarkFolder = Omit<components['schemas']['FolderResponse'], 'lastUsedAt'> & {
  lastUsedAt?: string | null;
};

export type BookmarkFolderListResponse = Omit<
  components['schemas']['FolderListResponse'],
  'folders'
> & {
  folders: BookmarkFolder[];
};

export type BookmarkFoldersResponse = components['schemas']['BookmarkFoldersResponse'];
