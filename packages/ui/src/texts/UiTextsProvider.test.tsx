import { describe, expect, it, vi } from 'vitest';
// Provider가 없는 상태를 그려야 해서 Testing Library의 render를 감싸지 않고 그대로 쓴다
import { render, screen } from '@testing-library/react';
import { Spinner } from '@link-sphere/ui/atoms/spinner';
import { KO_UI_TEXTS } from '@link-sphere/ui/texts/ko-ui-texts';
import { UiTextsProvider } from '@link-sphere/ui/texts/UiTextsProvider';

describe('UiTextsProvider', () => {
  it('Provider 없이 그리면 부품이 오류를 낸다', () => {
    // React가 잡히지 않은 렌더 오류를 console.error로도 남겨 테스트 출력이 지저분해진다
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Spinner />)).toThrow('useUiTexts must be used within a UiTextsProvider.');

    consoleError.mockRestore();
  });

  it('Provider로 넘긴 문구가 부품에 보인다', () => {
    render(
      <UiTextsProvider texts={{ ...KO_UI_TEXTS, spinner: { label: 'Loading' } }}>
        <Spinner />
      </UiTextsProvider>
    );

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(screen.queryByLabelText(KO_UI_TEXTS.spinner.label)).toBeNull();
  });

  it('패키지의 한국어 묶음을 그대로 넘기면 그 문구가 보인다', () => {
    render(
      <UiTextsProvider texts={KO_UI_TEXTS}>
        <Spinner />
      </UiTextsProvider>
    );

    expect(screen.getByLabelText(KO_UI_TEXTS.spinner.label)).toBeInTheDocument();
  });
});
