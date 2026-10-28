export class PlatformUtil {
  /**
   * macOS인지 확인한다. 단축키 힌트를 ⌘와 Ctrl 중 무엇으로 보여줄지 고를 때 쓴다.
   * 데스크톱 모드의 iPad Safari도 Macintosh를 보고해 ⌘로 보이는데, iPad 키보드에도 ⌘가 있다.
   * @returns macOS면 true
   */
  static isMac(): boolean {
    return /Mac/i.test(navigator.userAgent);
  }
}
