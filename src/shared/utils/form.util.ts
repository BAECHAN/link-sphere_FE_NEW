import { CommonUtil } from '@/shared/utils/common.util';

/**
 * React Hook Form 관련 유틸리티 함수
 */
export class FormUtil {
  /**
   * React Hook Form의 dirtyFields를 기반으로 변경된 값만 추출하는 유틸리티 함수
   * @param dirtyFields formState.dirtyFields
   * @param values form.getValues() 또는 data
   * @returns 변경된 필드만 포함된 객체
   */
  static getDirtyValues<T>(dirtyFields: Partial<Record<keyof T, unknown>>, values: T): Partial<T> {
    const dirtyValues: Partial<T> = {};

    Object.keys(dirtyFields).forEach((key) => {
      const k = key as keyof T;
      // dirtyFields[k]가 true이거나 객체(nested form)일 수 있음
      // 여기서는 1 depth만 고려하거나, 값이 존재하면 dirty로 간주
      if (dirtyFields[k]) {
        dirtyValues[k] = values[k];
      }
    });
    return dirtyValues;
  }

  /**
   * 폼 객체의 모든 문자열 필드에서 빈 문자열을 null로 변환
   * @example
   * emptyStringToNullInObject({ name: '', email: 'test@test.com', phone: '   ' })
   * -> { name: null, email: 'test@test.com', phone: null }
   *
   * @param obj 변환할 폼 객체
   * @returns 빈 문자열이 null로 변환된 객체
   */
  static emptyStringToNullInObject<T extends Record<string, unknown>>(obj: T): T {
    const result = { ...obj };

    for (const key in result) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        const value = result[key];
        if (typeof value === 'string') {
          result[key] = CommonUtil.emptyStringToNull(value) as T[typeof key];
        }
      }
    }

    return result;
  }

  /**
   * 객체/배열 내의 모든 문자열 값을 NFC로 정규화합니다. (Mac/Windows 한글 호환성)
   */
  static normalizePayload(data: unknown): unknown {
    if (typeof data === 'string') {
      return data.normalize('NFC');
    }

    if (Array.isArray(data)) {
      return data.map((item) => FormUtil.normalizePayload(item));
    }

    if (data !== null && typeof data === 'object') {
      const result: Record<string, unknown> = {};
      const dataObj = data as Record<string, unknown>;
      const keys = Object.keys(dataObj);

      keys.forEach((key) => {
        result[key] = FormUtil.normalizePayload(dataObj[key]);
      });

      return result;
    }

    return data;
  }
}
