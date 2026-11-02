// BE 요청 본문과 같아야 하는 폴더 이름 최대 길이(BE BookmarkFolderLimits.MAX_NAME_LENGTH). 값은 손으로 두고
// bookmark-folder.contract.test.ts가 스펙에서 생성한 상수(openapi.zod.ts)와 대조한다 - 생성 파일을 런타임에 import하면
// 그 안의 zod.object(...) 호출 때문에 zod-vendor가 첫 화면 청크에 실린다(docs/OPENAPI-CODEGEN.md §5-6). 이 상수는 목록
// 카드의 북마크 토글(BookmarkFolderUtil)이 쓴다.
//
// 스펙의 maxLength는 값만 담는다 - BE와 FE(BookmarkFolderUtil)는 둘 다 앞뒤 공백을 뗀 뒤 코드포인트로 센다. 이름은 말줄임
// 없이 어절 단위로 줄바꿈해 보여 주는데, 15자면 가장 좁은 자리(360px 폰의 폴더 카드, 108px)에서도 보통 2줄에 들어간다 —
// 실측과 대안 비교는 docs/BOOKMARK.md "폴더 이름 길이" 참고.
export const BOOKMARK_FOLDER_NAME_MAX_LENGTH = 15;
