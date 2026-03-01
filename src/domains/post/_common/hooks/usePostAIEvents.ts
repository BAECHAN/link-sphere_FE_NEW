import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '@/shared/config/api';
import { useAuthStore } from '@/shared/store/auth.store';
import { postInvalidateQueries } from '@/domains/post/_common/api/post.keys';
import { authApi } from '@/domains/auth/_common/api/auth.api';

/**
 * Post AI 분석 완료 SSE 이벤트를 구독하는 훅
 * AI 분석이 완료되면 자동으로 post 캐시를 무효화하여 최신 데이터를 반영합니다.
 *
 * 개선사항:
 * - 자동 재연결 로직 (지수 백오프 적용)
 * - 하트비트(ping) 모니터링 및 타임아웃 감지
 * - 연결 상태 정밀 관리
 * - 토큰 만료 시 자동 갱신 트리거 (ApiClient 인터셉터 활용)
 */
export function usePostAIEvents() {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isValidatingTokenRef = useRef(false);
  const accessToken = useAuthStore((state) => state.accessToken);

  // 최대 재연결 시도 횟수 및 딜레이 설정
  const MAX_RETRIES = 5;
  const BASE_RETRY_DELAY = 3000; // 3초
  const HEARTBEAT_TIMEOUT = 60000; // 60초 (서버는 45초마다 ping을 보냄)

  const connectSSE = useCallback(() => {
    if (!accessToken) return;

    // 기존 연결 정리
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // 타임아웃 클리어
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);

    const url = `${API_BASE_URL}/post/ai-events?token=${encodeURIComponent(accessToken)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    const handleReconnect = () => {
      if (retryCountRef.current >= MAX_RETRIES) {
        console.error('[SSE] 최대 재연결 횟수 초과, 연결 중단');
        return;
      }

      const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCountRef.current), 30000); // 최대 30초 대기
      console.log(
        `[SSE] ${delay / 1000}초 후 재연결 시도... (${retryCountRef.current + 1}/${MAX_RETRIES})`
      );

      reconnectTimeoutRef.current = setTimeout(() => {
        retryCountRef.current++;
        connectSSE();
      }, delay);
    };

    /**
     * 연결 오류 발생 시 토큰 유효성을 확인하고 재연결을 결정합니다.
     * API 호출을 통해 토큰이 만료되었다면 ApiClient가 자동으로 갱신(Refresh)을 시도합니다.
     * 갱신 성공 시 accessToken이 변경되어 useEffect가 재실행되므로 여기서는 아무것도 안 해도 됩니다.
     * 갱신 실패 시 로그아웃 처리되므로 역시 중단됩니다.
     * 유효한 토큰이라면 네트워크 오류로 간주하고 백오프 재연결을 시도합니다.
     */
    const validateTokenAndReconnect = async () => {
      if (isValidatingTokenRef.current) return;
      isValidatingTokenRef.current = true;

      try {
        // 가벼운 인증 API 호출로 토큰 검증 (실패 시 인터셉터가 갱신 시도)
        await authApi.fetchAccount();
        // 성공했다면 토큰은 유효함 -> 단순 네트워크 오류: 재연결 시도
        handleReconnect();
      } catch (error) {
        console.warn('[SSE] 토큰 검증 실패 또는 네트워크 오류:', error);
        // API 호출 자체가 실패했더라도, 인터셉터가 처리하지 못한 네트워크 오류일 수 있으므로 재연결 시도
        // (단, 401/403은 인터셉터가 처리함)
        handleReconnect();
      } finally {
        isValidatingTokenRef.current = false;
      }
    };

    const resetHeartbeatTimeout = () => {
      if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = setTimeout(() => {
        console.warn('[SSE] 하트비트 타임아웃 (No heartbeat), 재연결 시도...');
        eventSource.close();
        setIsConnected(false);
        validateTokenAndReconnect();
      }, HEARTBEAT_TIMEOUT);
    };

    eventSource.onopen = () => {
      console.log('[SSE] 연결 열림 (open)');
      setIsConnected(true);
      retryCountRef.current = 0; // 연결 성공 시 재시도 횟수 초기화
      resetHeartbeatTimeout();
    };

    eventSource.addEventListener('connect', () => {
      console.log('[SSE] 구독 연결 확인 (connect event)');
      setIsConnected(true);
      resetHeartbeatTimeout();
    });

    eventSource.addEventListener('ping', () => {
      resetHeartbeatTimeout();
    });

    eventSource.addEventListener('ai-complete', (event) => {
      try {
        const data = JSON.parse(event.data) as {
          postId: string;
          aiStatus: string;
          aiSummary?: string;
          tags?: string[];
        };
        console.log('[SSE] AI 분석 완료:', data);
        postInvalidateQueries.list();
        resetHeartbeatTimeout();
      } catch (error) {
        console.error('[SSE] AI 이벤트 파싱 실패:', error);
      }
    });

    eventSource.onerror = () => {
      console.warn('[SSE] 연결 오류 발생');
      eventSource.close();
      setIsConnected(false);
      validateTokenAndReconnect();
    };
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      connectSSE();
    } else {
      setIsConnected(false);
    }

    return () => {
      if (eventSourceRef.current) {
        console.log('[SSE] 컴포넌트 언마운트, 연결 종료');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
    };
  }, [accessToken, connectSSE]);

  return isConnected;
}
