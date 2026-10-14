export class ScrollUtil {
  /**
   * 코드로 일으키는 스크롤(scrollIntoView·scrollTo)의 behavior. 기기에서 "동작 줄이기"를 켠
   * 사용자(prefers-reduced-motion: reduce)에게는 화면 전체가 미끄러지는 움직임을 보내지 않고
   * 바로 이동한다 — 이런 움직임은 전정기관 장애가 있는 사람에게 어지럼증을 일으킬 수 있다
   * (MDN, https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
   * 'auto'는 CSS scroll-behavior를 따르는데 이 앱은 설정하지 않아 즉시 이동이 된다.
   * Firefox는 이 설정이면 smooth를 스스로 즉시로 바꾸지만(Mozilla Bug 1832598) 다른 브라우저는
   * 확인하지 못해 직접 처리한다. behavior: 'smooth'를 직접 쓰지 않도록 ESLint가 막는다.
   */
  static getBehavior(): ScrollBehavior {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }
}
