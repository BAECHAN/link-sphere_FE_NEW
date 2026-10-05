import { UPLOAD_IMAGE_EXTENSION_BY_MIME } from '@/shared/config/image-format';

/** 업로드를 허용하는 이미지 형식인지 - 파일명이 아니라 브라우저가 판정한 MIME(File.type)으로 본다. */
export function isAllowedImageType(mimeType: string): boolean {
  // in 연산자는 'toString' 같은 상속 프로퍼티까지 참으로 보므로 자기 키만 확인한다
  return Object.prototype.hasOwnProperty.call(UPLOAD_IMAGE_EXTENSION_BY_MIME, mimeType);
}

/**
 * 업로드할 때 서명 URL에 넘길 확장자. 파일명에서 뽑으면 `.jfif`(실제로는 JPEG)나 확장자 없는
 * 파일이 BE 허용 목록에서 거부된다 - MIME에서 뽑는다. 허용 목록 밖이면 undefined.
 */
export function getUploadExtension(mimeType: string): string | undefined {
  return isAllowedImageType(mimeType) ? UPLOAD_IMAGE_EXTENSION_BY_MIME[mimeType] : undefined;
}
