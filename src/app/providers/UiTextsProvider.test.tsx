import { describe, expect, it } from 'vitest';
import { APP_UI_TEXTS } from '@/app/providers/UiTextsProvider';
import { KO_UI_TEXTS } from '@/shared/ui/texts/ko-ui-texts';
import type { UiTexts } from '@/shared/ui/texts/ui-texts';

// 같은 문구가 앱 문구 파일(texts.ts)과 패키지의 한국어 묶음(ko-ui-texts.ts) 두 곳에 있다. 이 앱은 묶음을
// 쓰지 않지만, 묶음을 그대로 넘기는 다른 프로젝트가 이 앱과 다른 글자를 보지 않도록 여기서 잡는다.
// 일부러 다르게 둘 때 이 테스트를 지운다.
type UiTextValue = string | ((order: number) => string);

function flattenTexts(uiTexts: UiTexts): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const [group, entries] of Object.entries(uiTexts)) {
    for (const [key, value] of Object.entries<UiTextValue>(entries)) {
      // 함수형 키는 같은 인자로 부른 결과를 비교한다
      flat[`${group}.${key}`] = typeof value === 'function' ? value(3) : value;
    }
  }

  return flat;
}

describe('APP_UI_TEXTS', () => {
  const appTexts = flattenTexts(APP_UI_TEXTS);
  const bundleTexts = flattenTexts(KO_UI_TEXTS);

  it('패키지의 한국어 묶음과 묶음·키가 같다', () => {
    expect(Object.keys(appTexts).sort()).toEqual(Object.keys(bundleTexts).sort());
  });

  it.each(Object.keys(bundleTexts))('%s 문구가 패키지의 한국어 묶음과 같다', (path) => {
    expect(appTexts[path]).toBe(bundleTexts[path]);
  });
});
