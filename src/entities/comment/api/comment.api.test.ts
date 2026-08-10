import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { commentApi } from '@/entities/comment/api/comment.api';
import { uploadImageAndGetUrl } from '@/entities/upload/api/upload.api';

vi.mock('@/entities/upload/api/upload.api', () => ({
  uploadImageAndGetUrl: vi.fn(),
}));

function fakeImageFile(name: string): File {
  return new File([], name, { type: 'image/png' });
}

function jsonComment() {
  return HttpResponse.json(
    { status: 201, message: 'ok', data: mockComment, timestamp: new Date().toISOString() },
    { status: 201 }
  );
}

describe('commentApi.createComment - 이미지 업로드 동시성·순서', () => {
  beforeEach(() => {
    vi.mocked(uploadImageAndGetUrl).mockReset();
    // 이 테스트 파일이 실제로 요청하는 경로(/api/post/:id/comment)를 명시적으로 등록한다 -
    // src/mocks/handlers의 전역 핸들러는 /api 접두사 없이 등록돼 있어 매칭되지 않는다.
    server.use(http.post('/api/post/:id/comment', () => jsonComment()));
  });

  it('5장을 한 번에 올려도 동시에 2개까지만 처리한다', async () => {
    let activeCount = 0;
    let maxActiveCount = 0;
    vi.mocked(uploadImageAndGetUrl).mockImplementation(async (file: File) => {
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeCount -= 1;
      return `https://example.com/${file.name}`;
    });

    const images = [1, 2, 3, 4, 5].map((n) => fakeImageFile(`img${n}.png`));

    await commentApi.createComment('post-1', { content: '내용', images });

    expect(maxActiveCount).toBeLessThanOrEqual(2);
    expect(uploadImageAndGetUrl).toHaveBeenCalledTimes(5);
  });

  it('배치 안에서 먼저 시작한 파일이 늦게 끝나도 요청 바디의 이미지 순서는 입력 순서를 유지한다', async () => {
    // 각 배치(2개씩)의 첫 파일을 일부러 더 느리게 끝내 완료 순서와 입력 순서를 어긋나게 만든다.
    const delays: Record<string, number> = {
      'img1.png': 30,
      'img2.png': 5,
      'img3.png': 30,
      'img4.png': 5,
      'img5.png': 5,
    };
    vi.mocked(uploadImageAndGetUrl).mockImplementation(async (file: File) => {
      await new Promise((resolve) => setTimeout(resolve, delays[file.name] ?? 5));
      return `https://example.com/${file.name}`;
    });

    let capturedImages: string[] = [];
    server.use(
      http.post('/api/post/:id/comment', async ({ request }) => {
        const body = (await request.json()) as { images: string[] };
        capturedImages = body.images;
        return jsonComment();
      })
    );

    const images = [1, 2, 3, 4, 5].map((n) => fakeImageFile(`img${n}.png`));
    await commentApi.createComment('post-1', { content: '내용', images });

    expect(capturedImages).toEqual([
      'https://example.com/img1.png',
      'https://example.com/img2.png',
      'https://example.com/img3.png',
      'https://example.com/img4.png',
      'https://example.com/img5.png',
    ]);
  });
});
