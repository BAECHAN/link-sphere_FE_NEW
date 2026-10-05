/**
 * 업로드를 허용하는 이미지 형식(MIME → 업로드할 때 쓰는 확장자).
 *
 * 아래 다섯 곳이 이 목록을 함께 따라야 한다 - 어긋나면 FE가 받은 파일을 BE나 버킷이 거부해 사용자는
 * 원인 없이 "서버 오류"만 보게 된다(docs/plans/2026-10-05-image-upload-lifecycle.md).
 * - FE 첨부(useImageAttachments)·아바타(useUpdateAccount): 이 목록 밖이면 고르는 즉시 안내
 * - FE 업로드 확장자(uploadImageAndGetUrl): 파일명이 아니라 MIME에서 뽑는다(.jfif·확장자 없는 파일 대응)
 * - BE `UploadService.ALLOWED_EXTENSIONS`: 이 표의 확장자를 모두 포함해야 한다
 * - Supabase 버킷 `allowed_mime_types`: 이 표의 키를 모두 포함해야 한다(대시보드·Storage API 설정,
 *   2026-10-05 기준 png·jpeg·jpg·gif·webp·avif·svg+xml)
 * - 렌더러(MarkdownContent·imageContent의 확장자 정규식): 이 표의 확장자를 모두 포함해야 한다
 *
 * HEIC·HEIF는 넣지 않는다 - MDN 웹 이미지 형식 가이드에 없는 형식이라 올려도 보는 브라우저에 따라 깨질
 * 수 있다(2026-10-05 사용자 결정). 사용자 안내 문구(TEXTS.validation.imageFileOnly)도 이 목록을
 * 나열하므로 함께 고친다.
 */
export const UPLOAD_IMAGE_EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};
