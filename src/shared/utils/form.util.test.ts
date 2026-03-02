import { describe, expect, it } from 'vitest';
import { FormUtil } from '@/shared/utils/form.util';

describe('FormUtil', () => {
  describe('getDirtyValues', () => {
    it('dirty 필드만 추출하여 반환한다', () => {
      const dirtyFields = { name: true, age: true };
      const values = { name: 'Alice', age: 30, email: 'alice@example.com' };

      const result = FormUtil.getDirtyValues(dirtyFields, values);

      expect(result).toEqual({ name: 'Alice', age: 30 });
      expect(result).not.toHaveProperty('email');
    });

    it('dirty 필드가 없으면 빈 객체를 반환한다', () => {
      const result = FormUtil.getDirtyValues({}, { name: 'Bob' });
      expect(result).toEqual({});
    });

    it('false 값인 필드는 포함하지 않는다', () => {
      const dirtyFields = { name: true, email: false };
      const values = { name: 'Carol', email: 'carol@example.com' };

      const result = FormUtil.getDirtyValues(dirtyFields, values);

      expect(result).toHaveProperty('name', 'Carol');
      expect(result).not.toHaveProperty('email');
    });
  });

  describe('emptyStringToNullInObject', () => {
    it('빈 문자열을 null로 변환한다', () => {
      const result = FormUtil.emptyStringToNullInObject({ name: '', email: 'test@test.com' });
      expect(result.name).toBeNull();
      expect(result.email).toBe('test@test.com');
    });

    it('공백만 있는 문자열을 null로 변환한다', () => {
      const result = FormUtil.emptyStringToNullInObject({ nickname: '   ' });
      expect(result.nickname).toBeNull();
    });

    it('문자열이 아닌 값은 그대로 유지한다', () => {
      const result = FormUtil.emptyStringToNullInObject({ count: 0, active: false, value: null });
      expect(result.count).toBe(0);
      expect(result.active).toBe(false);
      expect(result.value).toBeNull();
    });
  });

  describe('normalizePayload', () => {
    it('문자열을 NFC로 정규화한다', () => {
      const nfd = '\u1100\u1161'; // NFC: '가'
      const result = FormUtil.normalizePayload(nfd);
      expect(result).toBe('\u1100\u1161'.normalize('NFC'));
    });

    it('배열 내의 문자열도 정규화한다', () => {
      const input = ['hello', 'world'];
      const result = FormUtil.normalizePayload(input);
      expect(result).toEqual(['hello', 'world']);
    });

    it('중첩 객체 내의 문자열도 정규화한다', () => {
      const input = { user: { name: 'Alice', tags: ['a', 'b'] } };
      const result = FormUtil.normalizePayload(input) as typeof input;
      expect(result.user.name).toBe('Alice');
      expect(result.user.tags).toEqual(['a', 'b']);
    });

    it('숫자, boolean, null은 그대로 반환한다', () => {
      expect(FormUtil.normalizePayload(42)).toBe(42);
      expect(FormUtil.normalizePayload(true)).toBe(true);
      expect(FormUtil.normalizePayload(null)).toBeNull();
    });
  });
});
