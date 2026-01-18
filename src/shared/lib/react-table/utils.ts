import { CellContext } from '@tanstack/react-table';

export const ReactTableUtil = {
  /**
   * 문자열 데이터의 길이를 제한하여 표시하는 Cell 렌더러를 반환합니다.
   * 제한 길이를 초과할 경우 말줄임표(...)를 붙입니다.
   *
   * @param limit 최대 글자 수 (기본값: 50)
   * @example
   *
   * columnHelper.accessor('description', {
   *   header: '설명',
   *   cell: ReactTableUtil.truncate(30),
   * })
   *    */
  truncate: <TData, TValue>(limit: number = 50) => {
    return (info: CellContext<TData, TValue>) => {
      const value = info.getValue();

      if (typeof value !== 'string') {
        return value;
      }

      if (value.length <= limit) {
        return value;
      }

      return `${value.slice(0, limit)}...`;
    };
  },
};
