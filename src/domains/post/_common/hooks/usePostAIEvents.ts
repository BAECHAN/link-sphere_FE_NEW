import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/shared/config/api';
import { useAuthStore } from '@/domains/auth/_common/model/auth.store';
import { postInvalidateQueries } from '@/domains/post/_common/api/post.keys';

/**
 * Post AI 분석 완료 SSE 이벤트를 구독하는 훅
 * AI 분석이 완료되면 자동으로 post 캐시를 무효화하여 최신 데이터를 반영합니다.
 */
export function usePostAIEvents() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    // SSE 연결 (인증 토큰을 쿼리 파라미터로 전달)
    const url = `${API_BASE_URL}/post/ai-events?token=${encodeURIComponent(accessToken)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // 연결 확인
    eventSource.onopen = () => {
      console.log('[SSE] 연결 열림 (open)');
    };

    eventSource.addEventListener('connect', () => {
      console.log('[SSE] AI 이벤트 구독 연결 완료 (connect event)');
    });

    // AI 분석 완료 이벤트
    eventSource.addEventListener('ai-complete', (event) => {
      try {
        const data = JSON.parse(event.data) as {
          postId: string;
          aiStatus: string;
          aiSummary?: string;
          tags?: string[];
        };
        console.log('[SSE] AI 분석 완료:', data);

        // 캐시 무효화 → React Query가 자동으로 데이터를 다시 가져옴
        postInvalidateQueries.list();
      } catch (error) {
        console.error('[SSE] AI 이벤트 파싱 실패:', error);
      }
    });

    eventSource.onerror = () => {
      console.warn('[SSE] 연결 오류 발생, 자동 재연결 시도...');
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [accessToken]);
}
