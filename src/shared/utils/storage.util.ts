/**
 * Storage 접근을 위한 공통 유틸리티 함수
 * localStorage와 sessionStorage 모두 지원
 */

/**
 * Storage 타입
 */
type StorageType = 'localStorage' | 'sessionStorage';

/**
 * Storage 인스턴스를 가져옵니다.
 */
function getStorage(type: StorageType): Storage {
  return type === 'localStorage' ? window.localStorage : window.sessionStorage;
}

/**
 * Storage 접근을 위한 공통 유틸리티 클래스
 */
class StorageUtil {
  /**
   * Storage에서 값을 가져옵니다.
   * JSON.parse를 자동으로 수행하며, 값이 없으면 null을 반환합니다.
   *
   * @param type Storage 타입 ('localStorage' | 'sessionStorage')
   * @param key Storage 키
   * @returns 파싱된 값 또는 null
   */
  static getItem<T>(type: StorageType, key: string): T | null {
    try {
      const storage = getStorage(type);
      const item = storage.getItem(key);
      if (item === null) {
        return null;
      }
      // JSON.parse 시도, 실패하면 원본 문자열 반환 (하위 호환성)
      try {
        return JSON.parse(item) as T;
      } catch (parseError) {
        // 이미 문자열로 저장된 경우 원본 반환 (하위 호환성)
        console.error(`Error parsing ${type} key "${key}":`, parseError);
        return item as T;
      }
    } catch (error) {
      console.error(`Error reading ${type} key "${key}":`, error);
      return null;
    }
  }

  /**
   * Storage에 값을 저장합니다.
   * JSON.stringify를 자동으로 수행합니다.
   *
   * @param type Storage 타입 ('localStorage' | 'sessionStorage')
   * @param key Storage 키
   * @param value 저장할 값 (객체, 배열 등도 가능)
   */
  static setItem<T>(type: StorageType, key: string, value: T): void {
    try {
      const storage = getStorage(type);
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting ${type} key "${key}":`, error);
    }
  }

  /**
   * Storage에서 값을 삭제합니다.
   *
   * @param type Storage 타입 ('localStorage' | 'sessionStorage')
   * @param key Storage 키
   */
  static removeItem(type: StorageType, key: string): void {
    try {
      const storage = getStorage(type);
      storage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${type} key "${key}":`, error);
    }
  }

  /**
   * Storage의 모든 값을 삭제합니다.
   *
   * @param type Storage 타입 ('localStorage' | 'sessionStorage')
   */
  static clear(type: StorageType): void {
    try {
      const storage = getStorage(type);
      storage.clear();
    } catch (error) {
      console.error(`Error clearing ${type}:`, error);
    }
  }
}

/**
 * localStorage 접근을 위한 유틸리티 함수
 * React 훅이 아닌 일반 함수/클래스에서 사용 가능
 *
 * @example
 * // 값 가져오기
 * const token = LocalStorageUtil.getItem<string>('refreshToken');
 *
 * // 값 저장하기
 * LocalStorageUtil.setItem('refreshToken', 'token-value');
 *
 * // 값 삭제하기
 * LocalStorageUtil.removeItem('refreshToken');
 */
export class LocalStorageUtil {
  static getItem<T>(key: string): T | null {
    return StorageUtil.getItem<T>('localStorage', key);
  }

  static setItem<T>(key: string, value: T): void {
    StorageUtil.setItem('localStorage', key, value);
  }

  static removeItem(key: string): void {
    StorageUtil.removeItem('localStorage', key);
  }

  static clear(): void {
    StorageUtil.clear('localStorage');
  }
}

/**
 * sessionStorage 접근을 위한 유틸리티 함수
 * React 훅이 아닌 일반 함수/클래스에서 사용 가능
 *
 * @example
 * // 값 가져오기
 * const data = SessionStorageUtil.getItem<string>('sessionData');
 *
 * // 값 저장하기
 * SessionStorageUtil.setItem('sessionData', 'data-value');
 *
 * // 값 삭제하기
 * SessionStorageUtil.removeItem('sessionData');
 */
export class SessionStorageUtil {
  static getItem<T>(key: string): T | null {
    return StorageUtil.getItem<T>('sessionStorage', key);
  }

  static setItem<T>(key: string, value: T): void {
    StorageUtil.setItem('sessionStorage', key, value);
  }

  static removeItem(key: string): void {
    StorageUtil.removeItem('sessionStorage', key);
  }

  static clear(): void {
    StorageUtil.clear('sessionStorage');
  }
}
