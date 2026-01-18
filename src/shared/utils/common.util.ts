export class CommonUtil {
  // ==================== 검증 함수들 ====================

  /**
   * 입력받은 condition을 단언합니다. TypeScript의 Asserts 함수로 사용합니다.
   * @example
   * let accountId: string | null;
   * assert(accountId != null, new Error('"accountId" 값이 없습니다'));
   * accountId; // string (type guarded)
   *
   * @param condition Asserts 조건
   * @param error Asserts 조건에 해당하지 않을 경우, throw 할 에러. string을 넘기는 경우, `new Error()` 를 감싸서 throw 합니다.
   * @throws {Error} condition이 false일 때
   */
  static assert(condition: unknown, error: Error | string = new Error()): asserts condition {
    if (!condition) {
      throw typeof error === 'string' ? new Error(error) : error;
    }
  }

  /**
   * 문자열이 비어있는지 확인
   * @param str 문자열
   * @returns 문자열이 비어있으면 true, 아니면 false
   */
  static isEmpty(str: string) {
    if (!str) return true;
    if (str.length === 0) return true;
    return str.trim().length === 0;
  }

  /**
   * 빈 문자열을 null로 변환
   * @example
   * emptyStringToNull('') -> null
   * emptyStringToNull('   ') -> null
   * emptyStringToNull('hello') -> 'hello'
   * emptyStringToNull(null) -> null
   * emptyStringToNull(undefined) -> null
   *
   * @param value 변환할 값
   * @returns 빈 문자열이면 null, 아니면 원본 값
   */
  static emptyStringToNull<T>(value: T | null | undefined): T | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' && this.isEmpty(value)) {
      return null;
    }
    return value;
  }

  /**
   * 주어진 값이 null이나 undefined인지 확인
   * @example
   * isNil(null) -> true
   * isNil(undefined) -> true
   * isNil(1) -> false
   *
   * @param value 확인할 값
   * @returns null이나 undefined이면 true, 아니면 false
   */
  static isNil<T>(value: T | null | undefined): value is null | undefined {
    return value === null || value === undefined;
  }

  /**
   * 주어진 값이 null이나 undefined가 아닌지 확인
   * @example
   * isNotNil(null) -> false
   * isNotNil(undefined) -> false
   * isNotNil(1) -> true
   *
   * @param value 확인할 값
   * @returns null이나 undefined가 아니면 true, 아니면 false
   */
  static isNotNil<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
  }

  /**
   * 배열이 비어있는지 확인
   * @param arr 배열
   * @returns 배열이 비어있으면 true, 아니면 false
   */
  static isEmptyArray<T>(arr: T[] | null | undefined): boolean {
    return !arr || arr.length === 0;
  }

  /**
   * 객체가 비어있는지 확인
   * @param obj 객체
   * @returns 객체가 비어있거나 null/undefined이면 true, 아니면 false
   */
  static isEmptyObject(obj: Record<string, unknown> | null | undefined): boolean {
    return !obj || Object.keys(obj).length === 0;
  }

  // ==================== 비교 함수들 ====================

  /**
   * 두 값이 서로 같은지 깊은 비교로 확인
   * 객체와 배열의 중첩 구조도 재귀적으로 비교
   * 순환 참조도 안전하게 처리
   * @param value1 첫 번째 값
   * @param value2 두 번째 값
   * @returns 두 값이 같으면 true, 다르면 false
   */
  static isDeepEqual(value1: unknown, value2: unknown): boolean {
    return this._deepEqual(value1, value2, new WeakSet());
  }

  /**
   * 두 배열이 서로 같은지 깊은 비교로 확인
   * 중첩된 배열과 객체도 재귀적으로 비교
   * @param arr1 첫 번째 배열
   * @param arr2 두 번째 배열
   * @returns 두 배열이 같으면 true, 다르면 false
   */
  static isEqualArray<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1 === arr2) return true;
    if (!arr1 || !arr2) return false;
    if (arr1.length !== arr2.length) return false;

    return arr1.every((item, index) => this.isDeepEqual(item, arr2[index]));
  }

  /**
   * 두 객체가 서로 같은지 깊은 비교로 확인
   * 중첩된 객체와 배열도 재귀적으로 비교
   * @param obj1 첫 번째 객체
   * @param obj2 두 번째 객체
   * @returns 두 객체가 같으면 true, 다르면 false
   */
  static isEqualObject<T extends Record<string, unknown>>(obj1: T, obj2: T): boolean {
    return this.isDeepEqual(obj1, obj2);
  }

  /**
   * 내부 깊은 비교 함수 (순환 참조 처리용)
   * @private
   */
  private static _deepEqual(value1: unknown, value2: unknown, visited: WeakSet<object>): boolean {
    if (value1 === value2) return true;

    if (value1 === null || value2 === null) return value1 === value2;
    if (value1 === undefined || value2 === undefined) return value1 === value2;

    if (typeof value1 !== typeof value2) return false;

    if (typeof value1 !== 'object') return value1 === value2;

    const obj1 = value1 as object;
    const obj2 = value2 as object;

    // 순환 참조 체크
    if (visited.has(obj1) || visited.has(obj2)) {
      return obj1 === obj2;
    }

    visited.add(obj1);
    visited.add(obj2);

    try {
      // Date 객체 비교
      if (value1 instanceof Date && value2 instanceof Date) {
        return value1.getTime() === value2.getTime();
      }

      // RegExp 객체 비교
      if (value1 instanceof RegExp && value2 instanceof RegExp) {
        return value1.toString() === value2.toString();
      }

      // 배열 비교
      if (Array.isArray(value1) && Array.isArray(value2)) {
        if (value1.length !== value2.length) return false;

        return value1.every((item, index) => this._deepEqual(item, value2[index], visited));
      }

      if (Array.isArray(value1) || Array.isArray(value2)) return false;

      // 객체 비교
      const obj1Record = value1 as Record<string, unknown>;
      const obj2Record = value2 as Record<string, unknown>;
      const keys1 = Object.keys(obj1Record);
      const keys2 = Object.keys(obj2Record);

      if (keys1.length !== keys2.length) return false;

      // Set을 사용하여 O(1) 조회 성능 향상
      const keys2Set = new Set(keys2);

      return keys1.every((key) => {
        if (!key || !keys2Set.has(key)) return false;

        const val1 = obj1Record[key];
        const val2 = obj2Record[key];

        return this._deepEqual(val1, val2, visited);
      });
    } finally {
      visited.delete(obj1);
      visited.delete(obj2);
    }
  }

  // ==================== 배열 관련 함수들 ====================

  /**
   * 배열의 마지막 요소를 가져옴
   * @param arr 배열
   * @returns 배열의 마지막 요소, 배열이 비어있거나 null/undefined이면 undefined
   */
  static getLastItem<T>(arr: T[] | null | undefined): T | undefined {
    if (!arr || arr.length === 0) return undefined;
    return arr[arr.length - 1];
  }

  /**
   * 배열에서 동일한 값을 하나만 남겨서 중복을 제거
   * 동일한지 여부는 SameValueZero 연산으로 판단
   * @example
   * uniq([1, 2, 2, 3]) -> [1, 2, 3]
   *
   * @param arr 중복을 제거할 배열
   * @returns 중복이 제거된 배열
   */
  static uniq<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
  }

  /**
   * 배열에서 중복을 제거하여, 동일한 값을 하나만 남김
   * hasher 함수의 값을 바탕으로 동일 여부를 판단
   * @example
   * uniqBy([{ x: 1 }, { x: 2 }, { x: 1 }], item => item.x) -> [{ x: 1 }, { x: 2 }]
   *
   * @param arr 중복을 제거할 배열
   * @param hasher 동일한지 여부를 판단할 hash를 생성하는 함수
   * @returns 중복이 제거된 배열
   */
  static uniqBy<T>(arr: T[], hasher: (x: T) => unknown): T[] {
    const seen = new Set<unknown>();
    const result: T[] = [];

    for (const item of arr) {
      const hash = hasher(item);
      if (!seen.has(hash)) {
        seen.add(hash);
        result.push(item);
      }
    }

    return result;
  }

  // ==================== 문자열 포맷팅 함수들 ====================

  /**
   * 문자열을 JSON 형식으로 변환
   * @param str 문자열
   * @returns JSON 형식의 문자열
   */
  static stringToJson(str: string) {
    if (this.isEmpty(str)) {
      throw new Error('문자열이 비어있습니다.');
    }

    return JSON.stringify(str, null, 2);
  }

  /**
   * 문자열에서 모든 점을 줄바꿈으로 변환
   * @param str 문자열
   * @returns 모든 점이 줄바꿈으로 변환된 문자열
   */
  static replaceAllDotsToNewLine(str: string) {
    return str.replace(/\./g, '.\n');
  }

  // ==================== 숫자/전화번호 포맷팅 함수들 ====================

  /**
   * 주어진 숫자를 콤마로 구분
   * @example
   * commaizeNumber(13209802) -> '13,209,802'
   * commaizeNumber('13209802') -> '13,209,802'
   *
   * @param value 숫자 또는 숫자 문자열
   * @returns 콤마로 구분된 문자열
   */
  static commaizeNumber(value: number | string): string {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * 주어진 unit 단위로 value를 내림
   * @example
   * floorToUnit(320980, 10000) -> 320000
   *
   * @param value 내림할 숫자
   * @param unit 단위
   * @returns 내림된 숫자
   */
  static floorToUnit(value: number, unit: number): number {
    return Math.floor(value / unit) * unit;
  }

  /**
   * 주어진 unit 단위로 value를 올림
   * @example
   * ceilToUnit(320980, 10000) -> 330000
   *
   * @param value 올림할 숫자
   * @param unit 단위
   * @returns 올림된 숫자
   */
  static ceilToUnit(value: number, unit: number): number {
    return Math.ceil(value / unit) * unit;
  }

  /**
   * 주어진 숫자를 한국 원화 형식으로 포맷
   * @example
   * formatToKRW(13209802) -> '1,320만 9,802원'
   * formatToKRW(13209802, { floorUnit: 10000 }) -> '1,320만원'
   * formatToKRW(13209802, { ceilUnit: 10000 }) -> '1,321만원'
   * formatToKRW(13200000, { formatAllDigits: true }) -> '천3백2십만원'
   *
   * @param value 변환할 숫자
   * @param options 포맷 옵션
   * @param options.shouldHaveSpaceBeforeWon 원 앞에 공백이 들어갑니다. 단독으로 금액을 표시할 때 true로 설정합니다.
   * @param options.floorUnit 내림할 단위
   * @param options.ceilUnit 올림할 단위
   * @param options.formatAllDigits true일 경우, 모든 자릿수를 format합니다.
   * @returns 한국 원화 형식 문자열
   */
  static formatToKRW(
    value: number,
    options?: {
      shouldHaveSpaceBeforeWon?: boolean;
      floorUnit?: number;
      ceilUnit?: number;
      formatAllDigits?: boolean;
    }
  ): string {
    let num = value;

    // floorUnit 또는 ceilUnit 처리
    if (options?.floorUnit) {
      num = Math.floor(num / options.floorUnit) * options.floorUnit;
    } else if (options?.ceilUnit) {
      num = Math.ceil(num / options.ceilUnit) * options.ceilUnit;
    }

    // formatAllDigits 옵션이 true인 경우 한글 숫자로 변환
    if (options?.formatAllDigits) {
      return this._formatToKoreanNumber(num) + (options?.shouldHaveSpaceBeforeWon ? ' 원' : '원');
    }

    // 만/억/조 단위로 변환
    const result = this._formatToKRWUnits(num);
    const space = options?.shouldHaveSpaceBeforeWon ? ' ' : '';

    return result + space + '원';
  }

  /**
   * 숫자를 만/억/조 단위로 변환하는 내부 함수
   * @private
   */
  private static _formatToKRWUnits(value: number): string {
    if (value === 0) return '0';

    const units = [
      { value: 1000000000000, label: '조' },
      { value: 100000000, label: '억' },
      { value: 10000, label: '만' },
    ];

    let result = '';
    let remaining = value;

    for (const unit of units) {
      if (remaining >= unit.value) {
        const count = Math.floor(remaining / unit.value);
        remaining = remaining % unit.value;

        if (count > 0) {
          result += this.commaizeNumber(count) + unit.label;
          if (remaining > 0) {
            result += ' ';
          }
        }
      }
    }

    // 만 단위 미만의 숫자 처리
    if (remaining > 0) {
      result += this.commaizeNumber(remaining);
    }

    return result.trim();
  }

  /**
   * 숫자를 한글 숫자로 변환하는 내부 함수
   * @private
   */
  private static _formatToKoreanNumber(value: number): string {
    if (value === 0) return '영';

    const koreanDigits = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const koreanUnits = [
      '',
      '십',
      '백',
      '천',
      '만',
      '십만',
      '백만',
      '천만',
      '억',
      '십억',
      '백억',
      '천억',
      '조',
    ];

    const numStr = Math.floor(value).toString();
    let result = '';

    for (let i = 0; i < numStr.length; i++) {
      const digit = parseInt(numStr[i]!, 10);
      const position = numStr.length - 1 - i;
      const unit = koreanUnits[position] || '';

      if (digit > 0) {
        if (digit === 1 && position > 0 && position < 4) {
          // 십, 백, 천 단위에서 1은 생략
          result += unit;
        } else {
          result += koreanDigits[digit] + unit;
        }
      }
    }

    return result;
  }

  /**
   * 휴대폰 번호 '-'가 있다면 제거, 없으면 그대로 반환
   * @example
   * 010-123-4567 -> 0101234567
   * 010-1234-5678 -> 01012345678
   * 01012345678 -> 01012345678
   *
   * @param phone 휴대폰 번호
   * @returns '-' 제거된 휴대폰 번호
   */
  static formatPhoneWithoutHyphen(phone: string) {
    return phone.trim().replace(/-/g, '');
  }

  /**
   * 휴대폰 번호 '-'가 없다면 '-'를 추가
   * 11자리, 10자리, 9자리 번호는 자동으로 포맷팅하며, 그 외의 경우에는 그대로 반환
   * @example
   * 01012345678 -> 010-1234-5678
   * 0212345678 -> 02-1234-5678
   * 021234567 -> 02-123-4567
   * 12345678 -> 12345678 (그 외의 경우 그대로 반환)
   *
   * @param phone 휴대폰 번호
   * @returns '-'가 추가된 휴대폰 번호 (11자리, 10자리, 9자리가 아닌 경우 원본 반환)
   */
  static formatPhoneWithHyphen(phone: string) {
    const trimmedPhone = phone.trim();

    // 11자리: 010-1234-5678 (3-4-4)
    if (trimmedPhone.length === 11) {
      return trimmedPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }

    // 10자리: 02-1234-5678 (2-4-4)
    if (trimmedPhone.length === 10) {
      return trimmedPhone.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
    }

    // 9자리: 02-123-4567 (2-3-4)
    if (trimmedPhone.length === 9) {
      return trimmedPhone.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
    }

    // 그 외의 경우는 그대로 반환
    return trimmedPhone;
  }

  // ==================== 파일 관련 함수들 ====================

  /**
   * 파일을 FormData에 append하는 공통 함수
   * 파일 이름이 한글이 깨지는 것을 방지하기 위해 인코딩 처리
   * @param formData FormData 객체
   * @param file 파일 객체
   * @param key FormData에 append할 key 값
   */
  static appendFileEncodedToFormData(formData: FormData, file: File, key: string): void {
    const blob = file.slice(0, file.size, file.type);
    const encodedFile = new File([blob], encodeURIComponent(file.name), { type: file.type });
    formData.append(key, encodedFile);
  }

  // ==================== 쿼리 파라미터 관련 함수들 ====================

  /**
   * 빈 문자열을 기본값으로 변환하는 헬퍼 함수
   * API 요청 시 빈 문자열로 인한 400 에러를 방지하기 위해 사용
   * @example
   * sanitizeQueryParams(
   *   { organ: '', license: 'A' },
   *   { organ: '*', license: '*' }
   * ) -> { organ: '*', license: 'A' }
   *
   * @param params 쿼리 파라미터 객체
   * @param defaults 기본값 객체 (빈 문자열을 대체할 값들)
   * @returns 빈 문자열이 기본값으로 변환된 객체
   */
  static sanitizeQueryParams<T extends Record<string, unknown>>(
    params: T,
    defaults: Partial<T>
  ): T {
    const sanitized = { ...params } as Record<string, unknown>;
    Object.keys(defaults).forEach((key) => {
      if (sanitized[key] === '') {
        sanitized[key] = defaults[key];
      }
    });
    return sanitized as T;
  }
}
