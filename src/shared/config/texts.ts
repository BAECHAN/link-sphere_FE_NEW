/**
 * UI 텍스트 상수
 *
 * 애플리케이션 전역에서 사용되는 UI 텍스트들을 중앙에서 관리합니다.
 * 다국어 지원을 위한 기반이 될 수 있습니다.
 */

// 여러 곳에서 재사용되는 공통 텍스트

const COMMON_TEXT = {
  saving: '저장 중...',
  back: '뒤로 가기',
  submitting: '등록 중...',
  updating: '수정 중...',
  confirm: '확인',
  cancel: '취소',
} as const;

// post 폼 create/update 공통 필드
const POST_FORM_COMMON = {
  titleLabel: '제목',
  categoryLabel: '관심 분야 (선택사항)',
  privateLabel: '나만 보기 (비공개)',
  privateDescription: '체크하면 팀원들에게 공유되지 않고 나만 볼 수 있는 게시물로 저장됩니다.',
} as const;

export const TEXTS = {
  common: { ...COMMON_TEXT },
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
    nickname: '한글/영문 2~20자 이내',
    email: 'example@email.com',
    password: '비밀번호 입력',
    message: '메시지를 입력하세요.',
    postSearch: '키워드나 @카테고리, #닉네임으로 검색...',
    bookmarkSearch: '북마크 내 검색...',
  },
  buttons: {
    retry: '다시 시도',
    refresh: '새로고침',
    home: '홈으로 이동',
    back: COMMON_TEXT.back,
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
    confirm: COMMON_TEXT.confirm,
    cancel: COMMON_TEXT.cancel,
  },
  auth: {
    title: '로그인',
    description: '아이디와 비밀번호를 입력해주세요',
    guard: {
      title: '로그인이 필요한 서비스입니다.',
    },
    login: {
      title: 'Welcome to LinkSphere',
      subtitle: 'Sign in to share and discover links',
      signingIn: 'Signing In...',
      signIn: 'Sign In',
      noAccount: "Don't have an account?",
      signUp: 'Sign Up',
    },
    signup: {
      title: 'Create an Account',
      subtitle: 'Join LinkSphere to start sharing links',
      signingUp: 'Signing Up...',
      signUp: 'Sign Up',
      alreadyAccount: 'Already have an account?',
      signIn: 'Sign In',
    },
  },
  nav: {
    brand: 'LinkSphere',
    feed: 'Feed',
    submit: 'Submit',
    bookmark: 'Bookmark',
    logIn: 'Log in',
    logOut: 'Log out',
    loggingOut: '로그아웃 중...',
    toggleMenu: 'Toggle menu',
    toggleSearch: 'Toggle search',
    toggleTheme: 'Toggle theme',
    saving: COMMON_TEXT.saving,
  },
  mypage: {
    title: '프로필 수정',
    description: '닉네임과 프로필 이미지를 변경할 수 있습니다.',
    save: '저장하기',
    saving: COMMON_TEXT.saving,
    changeImage: '이미지 변경',
  },
  post: {
    form: {
      create: {
        title: '링크 공유하기',
        description1: '팀원들과 공유하고 싶은 유용한 아티클이나 리소스의 URL을 입력하세요.',
        description2: '자동으로 제목과 이미지를 가져오고 태그를 생성합니다.',
        urlLabel: 'URL',
        urlPlaceholder: 'https://example.com/amazing-article',
        titleLabel: POST_FORM_COMMON.titleLabel,
        titlePlaceholder: '제목 (비워두면 자동으로 가져옵니다)',
        categoryLabel: POST_FORM_COMMON.categoryLabel,
        privateLabel: POST_FORM_COMMON.privateLabel,
        privateDescription: POST_FORM_COMMON.privateDescription,
        submit: '링크 공유하기',
      },
      update: {
        title: '링크 수정하기',
        description: 'URL, 제목, 관심 분야, 공개 설정을 수정할 수 있습니다.',
        urlLabel: 'URL',
        urlPlaceholder: 'https://example.com/amazing-article',
        urlChangedNotice: 'URL을 바꾸면 제목·설명·이미지·AI 요약을 새 링크에서 다시 가져옵니다.',
        titleLabel: POST_FORM_COMMON.titleLabel,
        titlePlaceholder: '제목 (비워두면 자동으로 가져옵니다)',
        categoryLabel: POST_FORM_COMMON.categoryLabel,
        privateLabel: POST_FORM_COMMON.privateLabel,
        privateDescription: POST_FORM_COMMON.privateDescription,
        updating: '수정하는 중...',
        update: '수정하기',
      },
    },
    card: {
      anonymous: 'Anonymous',
      visitWebsite: 'Visit Website',
      aiSummary: 'AI 요약',
      makePublic: '전체 공개로 전환',
      makePrivate: '비공개로 전환',
      edit: '수정',
      publicLabel: '전체 공개',
      privateLabel: '나만 보기',
      saving: COMMON_TEXT.saving,
      copyOriginalLink: '원본 링크 복사',
      visibilityConfirmTitle: '공개 설정 변경',
      visibilityToPublic: '전체 공개로',
      visibilityToPrivate: '나만 보기(비공개)로',
      visibilityConfirmMessage: (action: string) => `이 게시물을 ${action} 전환하시겠습니까?`,
    },
    detail: {
      notFound: '포스트를 찾을 수 없습니다.',
      back: COMMON_TEXT.back,
      heading: 'Post Details',
      commentsHeading: 'Comments',
    },
  },
  comment: {
    list: {
      loadError: '댓글을 불러오는데 실패했습니다.',
      heading: '댓글',
      empty: '첫 번째 댓글을 남겨보세요!',
    },
    form: {
      replyPlaceholder: '답글을 작성하세요...',
      commentPlaceholder: '댓글을 작성하세요...',
      editPlaceholder: '수정할 내용을 입력하세요...',
      preview: '미리보기',
      removeImage: '이미지 삭제',
      cancel: '취소',
      save: '저장',
      saving: COMMON_TEXT.saving,
      submitting: COMMON_TEXT.submitting,
      submitReply: '답글 등록',
      submitComment: '댓글 등록',
    },
    item: {
      authorBadge: '작성자',
      reply: '답글 달기',
      edit: '수정',
      like: '좋아요',
    },
  },
  bookmark: {
    empty: {
      all: '아직 북마크가 없어요.',
      uncategorized: '미분류 북마크가 없어요.',
      folder: '이 폴더는 비어있어요.',
      searchNoResult: '검색 결과가 없어요.',
    },
    folder: {
      all: '전체',
      uncategorized: '미분류',
      fallbackName: '폴더',
      pageTitle: '북마크',
      myFolders: '내 폴더',
      new: '새 폴더',
      create: '새 폴더 만들기',
      createSubmit: '생성',
      rename: '이름 수정',
      namePlaceholder: '새 폴더 이름',
      sortPlaceholder: '정렬',
      selectorTitle: '보관함',
      selectorDescription: '폴더를 탭하면 바로 저장돼요',
      removeBookmark: '북마크 제거',
      deleteConfirmTitle: (name: string) => `"${name}" 폴더 삭제`,
      deleteConfirmMessage: '폴더 안의 북마크는 미분류로 이동합니다.',
      sort: {
        latest: '최신 북마크순',
        oldest: '오래된순',
        title: '제목순',
        views: '조회수순',
      },
    },
  },
  errors: {
    errorOccurred: '오류 발생',
    notFound: {
      title: '페이지를 찾을 수 없습니다',
      description: '요청하신 페이지가 존재하지 않거나 삭제되었습니다.',
    },
    forbidden: {
      title: '접근 권한이 없습니다',
      description: '요청하신 페이지에 접근할 수 없습니다.',
    },
    serverError: {
      description: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    },
  },
  notification: {
    defaultTitle: '새로운 알림',
    viewAction: '보러가기',
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
    nicknameRegex: '닉네임은 2자 이상 20자 이하로 입력해주세요.',
    folderNameRequired: '폴더 이름을 입력해주세요.',
    categoryNameRequired: '카테고리 이름을 입력해주세요.',
    categorySlugRequired: '카테고리 슬러그를 입력해주세요.',
    invalidIdFormat: '유효하지 않은 ID 형식입니다.',
    commentOrImageRequired: '내용 또는 이미지를 추가해주세요.',
  },
  messages: {
    info: {
      noData: '조회할 데이터가 없습니다.',
      noPosts: '등록된 링크가 없거나 검색 결과가 없습니다.',
    },
    warning: {
      memberDeleteConfirm: '정말 이 회원을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
      postDeleteConfirm: '정말 이 포스트를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
      commentDeleteConfirm: '정말 이 댓글을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
    },
    success: {
      accountCreated: '회원이 생성되었습니다.',
      accountUpdated: '프로필이 업데이트되었습니다.',
      postCreated: '포스트가 생성되었습니다.',
      postUpdated: '포스트가 수정되었습니다.',
      postDeleted: '포스트가 삭제되었습니다.',
      linkCopied: '링크가 복사되었습니다.',
      originalLinkCopied: '원본 링크가 복사되었습니다.',
      postVisibilityUpdated: '게시물 공개 설정이 변경되었습니다.',
      folderRenamed: '폴더 이름 변경됨',
      folderDeleted: '폴더가 삭제됐어요',
      folderCreated: (name: string) => `폴더 "${name}" 생성됨`,
      bookmarkSavedTo: (folderName: string) => `${folderName}에 저장됨`,
      bookmarkRemoved: '북마크 제거됨',
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
      accountUpdateFailed: '프로필 업데이트에 실패했습니다.',
      nicknameDuplicate: '이미 사용 중인 닉네임입니다.',
      avatarUploadFailed: '이미지 업로드에 실패했습니다.',

      // 포스트 관련
      postCreateFailed: '포스트 생성에 실패했습니다.',
      postUpdateFailed: '포스트 수정에 실패했습니다.',
      fetchPosts: '포스트를 불러오는 중 오류가 발생했습니다.',
      postDeleteFailed: '포스트 삭제에 실패했습니다.',
      postVisibilityUpdateFailed: '게시물 공개 설정 변경에 실패했습니다.',

      // 북마크 폴더 관련
      folderRenameFailed: '이름 변경 실패',
      folderDeleteFailed: '폴더 삭제 실패',
      folderCreateFailed: '폴더 생성 실패',
      folderCreateFailedFull: '폴더 생성에 실패했습니다.',
      bookmarkSaveFailed: '저장에 실패했습니다.',
      bookmarkRemoveFailed: '북마크 제거에 실패했습니다.',

      // 권한 관련
      accessDenied: '접근 권한이 없습니다.',

      // 앱 초기화
      appInitFailed: '앱 초기화 실패:',

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

    // 북마크 폴더
    folderMenu: '폴더 메뉴',
    close: '닫기',
    backToFolderList: '폴더 목록으로',
    bookmarkChange: '북마크 폴더 변경',
    bookmarkSave: '북마크 저장',
  },
} as const;
