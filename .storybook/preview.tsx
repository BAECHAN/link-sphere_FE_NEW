import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import '../src/app/globals.css';

// 실제 앱의 다크모드 구현(src/main.tsx의 ThemeProvider attribute="class")과 동일하게
// <html>에 'dark' 클래스를 토글한다 - globals.css의 @custom-variant dark (&:is(.dark *))
// 가 이 클래스를 기준으로 .dark 토큰 세트를 적용하므로, 새 의존성(addon-themes 등) 없이
// 클래스 토글만으로 실제 앱과 동일한 다크모드를 재현할 수 있다.
function withTheme(Story: () => React.ReactNode, context: { globals: { theme?: string } }) {
  const theme = context.globals.theme ?? 'light';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return <Story />;
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      description: '다크모드 토글',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
};

export default preview;
