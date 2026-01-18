/**
 * src/shared/utils/file.util.ts
 *
 * 파일 처리를 위한 유틸리티
 */
export const FileUtil = {
  /**
   * Blob 데이터를 받아 브라우저 다운로드를 트리거합니다.
   *
   * @param blob - 다운로드할 Blob 데이터
   * @param fileName - 저장할 파일명 (확장자 포함)
   */
  downloadFromBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
