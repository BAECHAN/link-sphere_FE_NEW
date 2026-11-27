import { useEffect, useRef, useState } from 'react';
import { useWatch, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { TEXTS } from '@/shared/config/texts';
import { UrlUtil } from '@/shared/utils/url.util';

interface SharedTextFields {
  url: string;
  title?: string;
}

type SplitNoticeKind = keyof typeof TEXTS.post.form.sharedText;

interface SharedTextUrlSplitOptions {
  /**
   * 제목 칸에 글자가 있어도 곧 비워질 때 true를 준다 - 수정 폼은 URL을 처음 바꾸면 제목을 비운다
   * (useUpdatePost의 clearDerivedFieldsOnUrlChange). 구독을 다시 걸지 않게 참조가 바뀌지 않는 함수를 넘긴다.
   */
  willClearTitle?: (url: string) => boolean;
}

/**
 * 앱의 "링크 복사"가 URL 앞에 글자를 붙여 준 공유 문구(예: 네이버 지도 `알배기 독막로3길 35 2층 https://naver.me/…`)를
 * URL 칸에 넣으면 URL만 남기고, 제목 칸이 비었으면 나머지 글자를 제목으로 옮긴다. 직접 쓴 제목은 덮지 않는다.
 * 등록·수정 폼 공용이고, 돌려주는 문구는 URL 칸 아래 안내다(URL 칸을 다시 고치면 사라진다).
 *
 * 붙여넣기 이벤트 대신 값 구독으로 나눈다 - FormInput이 register의 onChange를 props 뒤에 펼쳐 가로챌 수 없고, 값 구독은
 * 붙여넣기 이벤트 없이 글자를 넣는 키보드 클립보드도 잡는다. 구독 콜백은 검증보다 먼저 불리고, 검증이 끝났을 때 값이
 * 바뀌어 있으면 react-hook-form이 그 결과를 버려(7.91.0 dist/index.esm.mjs:2900-2904, 2972-2978) 형식 오류 문구가
 * 한 번도 그려지지 않는다.
 */
export function useSharedTextUrlSplit<T extends FieldValues & SharedTextFields>(
  form: UseFormReturn<T>,
  options: SharedTextUrlSplitOptions = {}
): string | undefined {
  // 제네릭 T로는 'url'·'title' 경로를 좁히지 못해 두 칸만 가진 폼으로 본다 - T가 두 칸을 가진 것은 제약이 보장한다
  const fields = form as unknown as UseFormReturn<SharedTextFields>;
  const { willClearTitle } = options;
  const [noticeKind, setNoticeKind] = useState<SplitNoticeKind | null>(null);
  // 우리가 남긴 URL - 이 값에서 바뀌면 사용자가 URL을 고친 것이라 안내를 지운다
  const splitUrlRef = useRef<string | null>(null);
  // 제목으로 옮길 글자 - 제목 칸이 비는 때(수정 폼은 URL 변경으로 비워진 뒤)에 채운다
  const pendingTitleRef = useRef<string | null>(null);

  useEffect(
    function splitSharedTextOnUrlChange() {
      return fields.subscribe({
        formState: { values: true },
        callback: () => {
          const value = fields.getValues('url');
          const split = UrlUtil.splitSharedText(value);

          if (split) {
            const canFillTitle =
              !fields.getValues('title')?.trim() || (willClearTitle?.(split.url) ?? false);

            // setValue가 이 콜백을 다시 부르므로 그 전에 남긴 URL을 적어 둔다
            splitUrlRef.current = split.url;
            pendingTitleRef.current = canFillTitle ? split.text : null;
            setNoticeKind(canFillTitle ? 'movedToTitle' : 'urlOnly');
            fields.setValue('url', split.url, { shouldDirty: true, shouldValidate: true });
            return;
          }

          if (splitUrlRef.current !== null && value !== splitUrlRef.current) {
            splitUrlRef.current = null;
            pendingTitleRef.current = null;
            setNoticeKind(null);
          }
        },
      });
    },
    [fields, willClearTitle]
  );

  const titleValue = useWatch({ control: fields.control, name: 'title' });

  useEffect(
    function fillTitleFromSharedText() {
      // 제목 값도 의존한다 - 수정 폼은 이 effect보다 늦게 제목이 비워질 수 있어 비워진 뒤 다시 본다
      const text = pendingTitleRef.current;

      if (text === null || titleValue?.trim()) {
        return;
      }

      pendingTitleRef.current = null;
      fields.setValue('title', text, { shouldDirty: true, shouldValidate: true });
    },
    [noticeKind, titleValue, fields]
  );

  return noticeKind ? TEXTS.post.form.sharedText[noticeKind] : undefined;
}
