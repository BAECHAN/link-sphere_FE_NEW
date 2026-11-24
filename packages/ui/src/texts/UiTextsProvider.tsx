import { createContext, useContext, type ReactNode } from 'react';

import type { UiTexts } from '@baechan/ui/texts/ui-texts';

// 기본값을 두지 않는다(null) - 문구를 넘기지 않았는데 글자가 나오면 그 글자가 어디서 왔는지 코드로 알 수 없다.
// createContext의 기본값은 맞는 Provider가 없을 때 읽히는 값이다
// (https://react.dev/reference/react/createContext#parameters).
const UiTextsContext = createContext<UiTexts | null>(null);

interface UiTextsProviderProps {
  /**
   * 부품이 보여 줄 문구 전체. 직접 적거나 `KO_UI_TEXTS`(한국어 묶음)를 넘긴다.
   * 모듈 상수로 넘긴다 - 값이 바뀌면 이 문구를 읽는 부품이 모두 다시 그려진다
   * (https://react.dev/reference/react/useContext#returns).
   */
  texts: UiTexts;
  children: ReactNode;
}

/**
 * 공용 UI 부품이 스스로 보여 주는 글자를 넘기는 Provider. 앱 맨 위에 한 번 둔다 - 없으면 부품이 오류를 낸다.
 */
export function UiTextsProvider({ texts, children }: UiTextsProviderProps) {
  // 설치본이 React 18이라 <Context.Provider>로 감싼다 - <Context>를 바로 쓰는 것은 React 19부터다
  // (https://react.dev/reference/react/createContext#provider)
  return <UiTextsContext.Provider value={texts}>{children}</UiTextsContext.Provider>;
}

/**
 * 공용 UI 부품이 스스로 보여 주는 글자를 읽는다. `UiTextsProvider` 밖에서 부르면 오류를 낸다.
 */
export function useUiTexts(): UiTexts {
  const uiTexts = useContext(UiTextsContext);

  if (uiTexts === null) {
    throw new Error('useUiTexts must be used within a UiTextsProvider.');
  }

  return uiTexts;
}
