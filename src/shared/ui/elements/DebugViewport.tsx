import { useEffect, useState } from 'react';

/**
 * ⚠️ 임시 진단용 컴포넌트 — 모바일 감지 원인 파악 후 제거 예정.
 * 기기의 실제 뷰포트/배율/UA 값을 화면에 표시한다.
 */
export function DebugViewport() {
  const [, forceUpdate] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(function subscribeViewportChanges() {
    const rerender = () => forceUpdate((n) => n + 1);
    window.addEventListener('resize', rerender);
    window.addEventListener('orientationchange', rerender);
    return () => {
      window.removeEventListener('resize', rerender);
      window.removeEventListener('orientationchange', rerender);
    };
  }, []);

  if (hidden) return null;

  const rows: Array<[string, string]> = [
    ['innerWidth', String(window.innerWidth)],
    ['innerHeight', String(window.innerHeight)],
    ['screen.width', String(window.screen.width)],
    ['screen.height', String(window.screen.height)],
    ['devicePixelRatio', String(window.devicePixelRatio)],
    ['orientation', screen.orientation?.type ?? '(none)'],
    ['max-width:768px', String(window.matchMedia('(max-width: 768px)').matches)],
    ['min-width:768px(md)', String(window.matchMedia('(min-width: 768px)').matches)],
    ['pointer:coarse', String(window.matchMedia('(pointer: coarse)').matches)],
    ['maxTouchPoints', String(navigator.maxTouchPoints)],
    ['userAgent', navigator.userAgent],
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.88)',
        color: '#0f0',
        font: '12px/1.5 monospace',
        padding: '8px 10px',
        wordBreak: 'break-all',
      }}
    >
      {rows.map(([k, v]) => (
        <div key={k}>
          <span style={{ color: '#ff0' }}>{k}</span>: {v}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setHidden(true)}
        style={{
          marginTop: 6,
          padding: '4px 10px',
          background: '#333',
          color: '#fff',
          border: '1px solid #666',
          borderRadius: 4,
        }}
      >
        ✕ close
      </button>
    </div>
  );
}
