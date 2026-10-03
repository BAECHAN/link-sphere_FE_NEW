import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { createTestQueryClient } from '@/test/utils';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { TEXTS } from '@/shared/config/texts';
import { useLinkPreview } from '@/entities/post/hooks/useLinkPreview';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

describe('useLinkPreview', () => {
  it('형식이 맞는 URL이면 입력이 멈춘 뒤 미리보기를 가져온다', async () => {
    const { result } = renderHook(() => useLinkPreview('https://react.dev/learn', true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current).toMatchObject({
      status: 'ready',
      preview: { title: 'Quick Start – React', url: 'https://react.dev/learn' },
    });
  });

  it('형식이 틀렸거나 조회를 끄면 묻지 않는다(idle)', () => {
    const invalid = renderHook(() => useLinkPreview('react dev', true), { wrapper });
    const disabled = renderHook(() => useLinkPreview('https://react.dev/learn', false), {
      wrapper,
    });

    expect(invalid.result.current.status).toBe('idle');
    expect(disabled.result.current.status).toBe('idle');
  });

  it('도메인을 찾을 수 없으면 카드 대신 URL 칸에 띄울 문구를 돌려준다', async () => {
    server.use(
      http.get(url(API_ENDPOINTS.post.linkPreview), () =>
        HttpResponse.json(
          { status: 400, code: 'URL_UNRESOLVABLE', message: 'Cannot resolve host' },
          { status: 400 }
        )
      )
    );
    const { result } = renderHook(() => useLinkPreview('https://velgo.io/a', true), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('urlError'));

    expect(result.current).toEqual({
      status: 'urlError',
      message: TEXTS.messages.error.postSubmit.urlUnresolvable,
    });
  });

  it('그 외 실패(서버 오류·한도)는 등록을 막지 않는 failed로 돌려준다', async () => {
    server.use(
      http.get(url(API_ENDPOINTS.post.linkPreview), () =>
        HttpResponse.json(
          { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
          { status: 429 }
        )
      )
    );
    const { result } = renderHook(() => useLinkPreview('https://react.dev/learn', true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('failed'));
  });

  it('입력이 이어지는 동안은 묻지 않고, 0.5초 멈춘 뒤 마지막 값으로 한 번만 묻는다', async () => {
    const requestedUrls: string[] = [];
    server.use(
      http.get(url(API_ENDPOINTS.post.linkPreview), ({ request }) => {
        const target = new URL(request.url).searchParams.get('url') ?? '';
        requestedUrls.push(target);
        return HttpResponse.json({ status: 200, message: 'ok', data: { url: target, title: 't' } });
      })
    );
    const { result, rerender } = renderHook(({ value }) => useLinkPreview(value, true), {
      wrapper,
      // 등록 폼처럼 빈 칸에서 시작한다
      initialProps: { value: '' },
    });

    // 타이핑처럼 0.5초 안에 값이 계속 바뀐다
    for (const value of ['https://react.dev', 'https://react.dev/le', 'https://react.dev/learn']) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      rerender({ value });
    }

    expect(requestedUrls).toEqual([]);

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(requestedUrls).toEqual(['https://react.dev/learn']);
  });
});
