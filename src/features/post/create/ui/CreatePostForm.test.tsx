import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { renderWithProviders, userEvent } from '@/test/utils';
import { CreatePostForm } from '@/features/post/create/ui/CreatePostForm';
import { useAuthStore } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';
import { TooltipProvider } from '@baechan/ui/atoms/tooltip';

// 관심 분야 목록은 이 테스트가 보는 URL·제목 칸과 무관하다(UpdatePostForm.test.tsx와 같은 이유)
vi.mock('@/entities/category/hooks/useCategoryOptions', () => ({
  useCategoryOptions: () => ({ categoryOptionList: [] }),
}));

const { movedToTitle, urlOnly } = TEXTS.post.form.sharedText;
const SHARED_TEXT = '알배기 독막로3길 35 2층 https://naver.me/abc';

// 형식 오류 문구가 한 번이라도 그려졌는지 - 마지막 화면만 보면 잠깐 떴다 사라진 것을 놓친다
let urlFormatShown = false;
let observer: MutationObserver | undefined;

function watchUrlFormatError() {
  urlFormatShown = false;
  observer = new MutationObserver(() => {
    if (document.body.textContent?.includes(TEXTS.validation.urlFormat)) {
      urlFormatShown = true;
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function renderForm() {
  renderWithProviders(
    <TooltipProvider>
      <CreatePostForm renderFolderSelect={() => null} />
    </TooltipProvider>
  );

  return {
    urlInput: screen.getByLabelText(/URL/),
    titleInput: screen.getByLabelText(TEXTS.post.form.create.titleLabel),
    submitButton: screen.getByRole('button', { name: TEXTS.post.form.create.submit }),
  };
}

describe('CreatePostForm 공유 문구 나누기', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth('test-access-token');
  });

  afterEach(() => {
    observer?.disconnect();
  });

  it('URL 앞에 글자가 붙은 공유 문구를 붙여 넣으면 URL만 남기고 앞 글자를 제목으로 옮긴다', async () => {
    const user = userEvent.setup();
    const { urlInput, titleInput, submitButton } = renderForm();
    watchUrlFormatError();

    await user.click(urlInput);
    await user.paste(SHARED_TEXT);

    await waitFor(() => expect(urlInput).toHaveValue('https://naver.me/abc'));
    await waitFor(() => expect(titleInput).toHaveValue('알배기 독막로3길 35 2층'));
    expect(screen.getByText(movedToTitle)).toBeInTheDocument();
    await waitFor(() => expect(submitButton).toBeEnabled());
    expect(urlFormatShown).toBe(false);
  });

  it('제목을 먼저 써 두었으면 제목은 그대로 두고 URL만 남긴다', async () => {
    const user = userEvent.setup();
    const { urlInput, titleInput } = renderForm();

    await user.type(titleInput, '내가 쓴 제목');
    await user.click(urlInput);
    await user.paste(SHARED_TEXT);

    expect(urlInput).toHaveValue('https://naver.me/abc');
    expect(await screen.findByText(urlOnly)).toBeInTheDocument();
    expect(titleInput).toHaveValue('내가 쓴 제목');
  });

  it('나눈 뒤 URL 칸을 다시 고치면 안내가 사라진다', async () => {
    const user = userEvent.setup();
    const { urlInput } = renderForm();

    await user.click(urlInput);
    await user.paste(SHARED_TEXT);
    expect(await screen.findByText(movedToTitle)).toBeInTheDocument();

    await user.type(urlInput, 'd');

    expect(urlInput).toHaveValue('https://naver.me/abcd');
    expect(screen.queryByText(movedToTitle)).not.toBeInTheDocument();
  });

  it('나눈 뒤 다른 공유 문구를 다시 붙여 넣어도 새로 나누고 안내를 남긴다', async () => {
    const user = userEvent.setup();
    const { urlInput, titleInput } = renderForm();

    await user.click(urlInput);
    await user.paste(SHARED_TEXT);
    expect(await screen.findByText(movedToTitle)).toBeInTheDocument();

    (urlInput as HTMLInputElement).select();
    await user.paste('다른 가게 https://naver.me/xyz');

    expect(urlInput).toHaveValue('https://naver.me/xyz');
    // 제목은 첫 번째에서 채워져 덮지 않는다
    expect(await screen.findByText(urlOnly)).toBeInTheDocument();
    expect(titleInput).toHaveValue('알배기 독막로3길 35 2층');
  });

  it('등록 요청에 나눈 URL과 제목이 한 글자도 빠지지 않고 실린다', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_BASE_URL}${API_ENDPOINTS.post.base}`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;

        return HttpResponse.json({ status: 201, message: 'ok', data: mockPost }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    const { urlInput, titleInput, submitButton } = renderForm();

    await user.click(urlInput);
    // 쿼리·조각까지 붙은 URL과 괄호·숫자가 섞인 앞 글자 - 잘리거나 빠지면 아래 비교가 실패한다
    await user.paste(
      '[네이버지도] 알배기 (망원) 독막로3길 35 2층 https://naver.me/abc?x=1&y=2#top'
    );
    await waitFor(() =>
      expect(titleInput).toHaveValue('[네이버지도] 알배기 (망원) 독막로3길 35 2층')
    );
    await waitFor(() => expect(submitButton).toBeEnabled());
    await user.click(submitButton);

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({
      url: 'https://naver.me/abc?x=1&y=2#top',
      title: '[네이버지도] 알배기 (망원) 독막로3길 35 2층',
    });
  });

  it('제목을 먼저 써 두었으면 그 제목과 나눈 URL로 등록 요청을 보낸다', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_BASE_URL}${API_ENDPOINTS.post.base}`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;

        return HttpResponse.json({ status: 201, message: 'ok', data: mockPost }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    const { urlInput, titleInput, submitButton } = renderForm();

    await user.type(titleInput, '내가 쓴 제목');
    await user.click(urlInput);
    await user.paste(SHARED_TEXT);
    await waitFor(() => expect(submitButton).toBeEnabled());
    await user.click(submitButton);

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({ url: 'https://naver.me/abc', title: '내가 쓴 제목' });
  });

  it('http(s):// 주소가 없는 글이면 지금처럼 형식 오류 문구를 띄운다', async () => {
    const user = userEvent.setup();
    const { urlInput, titleInput } = renderForm();

    await user.click(urlInput);
    await user.paste('알배기 독막로3길 35 2층');

    expect(await screen.findByText(TEXTS.validation.urlFormat)).toBeInTheDocument();
    expect(urlInput).toHaveValue('알배기 독막로3길 35 2층');
    expect(titleInput).toHaveValue('');
  });
});
