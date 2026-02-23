/**
 * UI 텍스트 상수
 *
 * 애플리케이션 전역에서 사용되는 UI 텍스트들을 중앙에서 관리합니다.
 * 다국어 지원을 위한 기반이 될 수 있습니다.
 */

export const TEXTS = {
  pages: {
    home: '홈',
    post: {
      ROOT: '링크',
      SUBMIT: '링크 등록',
    },
  },
  labels: {
    nickname: '닉네임',
    email: '이메일',
    password: '비밀번호',
    message: '메시지',
  },
  placeholders: {
    nickname: '한글/영문 2~10자 이내',
    email: 'example@email.com',
    password: '비밀번호 입력',
    message: '메시지를 입력하세요.',
  },
  buttons: {
    retry: '다시 시도',
    refresh: '새로고침',
    home: '홈으로 이동',
    back: '뒤로 가기',
    login: '로그인',
    profileEdit: '프로필 수정',
    logout: '로그아웃',
    excelDownload: '엑셀 다운로드',
    reset: '초기화',
    bookmarkOnly: '북마크한',
    myPosts: '내가 작성한',
    privateOnly: '나만 볼 수 있는',
    search: '검색',
    delete: '삭제',
  },
  auth: {
    title: '로그인',
    description: '아이디와 비밀번호를 입력해주세요',
  },
  descriptions: {
    passwordGuide: '영문, 숫자, 특수문자 조합 8자 이상',
  },
  validation: {
    urlFormat: '유효하지 않은 URL 형식입니다.',
    urlRequired: 'URL을 입력해주세요.',
    contentRequired: '내용을 입력해주세요.',
    titleRequired: '제목을 입력해주세요.',
    idRequired: '아이디를 입력해주세요.',
    passwordRequired: '비밀번호를 입력해주세요.',
    passwordRegex: '비밀번호는 8자 이상, 영문, 숫자, 특수문자 조합으로 입력해주세요.',
    passwordMaxLength: '비밀번호는 20자 이하로 입력해주세요.',
    emailRegex: '올바른 이메일 형식(예: user@mail.com)인지 확인해 주세요.',
    nicknameRegex: '닉네임은 2자 이상 10자 이하로 입력해주세요.',
  },
  messages: {
    info: {
      noData: '조회할 데이터가 없습니다.',
      noPosts: '등록된 링크가 없거나 검색 결과가 없습니다.',
    },
    warning: {
      memberDeleteConfirm: '정말 이 회원을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
      postDeleteConfirm: '정말 이 포스트를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
    },
    success: {
      accountCreated: '회원이 생성되었습니다.',
      postCreated: '포스트가 생성되었습니다.',
      postDeleted: '포스트가 삭제되었습니다.',
      linkCopied: '링크가 복사되었습니다.',
    },
    error: {
      // 공통
      defaultError: '오류가 발생했습니다.',
      serverError: '서버 오류가 발생했습니다.',
      unknownError: '알 수 없는 오류가 발생했습니다.',
      apiRequestFailed: 'API 요청 실패',
      loginRequired: '로그인이 필요합니다.',

      // 인증 관련
      unauthorizedAccessToken: '액세스 토큰이 유효하지 않습니다.',
      unauthorizedRefreshToken: '리프레시 토큰이 유효하지 않습니다.',
      loginFailed: '로그인에 실패했습니다.',
      loginFailedPasswordMismatch: '아이디 또는 비밀번호가 일치하지 않습니다.',
      logoutError: '로그아웃 처리 중 오류 발생',
      tokenRefreshFailed: '토큰 갱신 실패',
      authRestoreFailed: '인증 복원 실패',
      loginError: '로그인 실패',
      userInfoNotFound: '사용자 정보를 찾을 수 없습니다.',
      fetchAccount: '계정 정보 조회 실패',
      accountCreateFailed: '계정 생성 실패',
      accountCreateFailedDuplicateAccount: '해당 이메일로 가입된 계정이 존재합니다.',

      // 포스트 관련
      postCreateFailed: '포스트 생성에 실패했습니다.',
      fetchPosts: '포스트를 불러오는 중 오류가 발생했습니다.',
      postDeleteFailed: '포스트 삭제에 실패했습니다.',

      // 권한 관련
      accessDenied: '접근 권한이 없습니다.',

      // 유틸
      linkCopyFailed: '링크 복사에 실패했습니다.',
    },
  },
  shortcuts: {
    sidebarToggle: 'Ctrl + B',
    sidebarToggleMac: '⌘ + B',
  },
  ariaLabels: {
    // 레이아웃
    appLayout: '앱 레이아웃',
    bodyContainer: '본문 컨테이너',
    sidebarWrapper: '사이드바 래퍼',
    contentArea: '컨텐츠 영역',
    mainContent: '메인 컨텐츠',
    pageContainer: '페이지 컨테이너',
    // 페이지 레이아웃
    authLayout: '인증 레이아웃',
    authContent: '인증 컨텐츠',
    errorLayout: '에러 레이아웃',
    errorContent: '에러 컨텐츠',
    errorDetail: '에러 상세 정보',
    errorActions: '에러 액션 버튼',
    // 헤더/푸터/사이드바
    appHeader: '앱 헤더',
    headerContainer: '헤더 컨테이너',
    headerLeftSection: '헤더 왼쪽 영역',
    headerUserSection: '헤더 사용자 영역',
    userInfo: '사용자 정보',
    appFooter: '앱 푸터',
    footerContainer: '푸터 컨테이너',
    footerContent: '푸터 컨텐츠',
    sidebarNavigation: '사이드바 네비게이션',
    sidebarNavigationList: '사이드바 네비게이션 메뉴 목록',
    // 페이지 헤더
    pageHeader: '페이지 헤더',
    pageHeaderTop: '페이지 헤더 상단',
    pageHeaderActions: '페이지 헤더 액션',
    // 기타
    menuToggle: '메뉴 토글',
    homeLink: '홈으로 이동',
    profileEdit: '프로필 수정',
    logout: '로그아웃',
    saveEmail: 'Save Email',

    // 입력 필드
    inputClear: '입력값 지우기',
  },
} as const;
