/**
 * UI 텍스트 상수
 *
 * 애플리케이션 전역에서 사용되는 UI 텍스트들을 중앙에서 관리합니다.
 * 다국어 지원을 위한 기반이 될 수 있습니다.
 */

// 여러 곳에서 재사용되는 공통 텍스트

const COMMON_TEXT = {
  saving: '저장 중...',
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
  privateDescription: '체크하면 팀원들에게 공유되지 않고 나만 볼 수 있는 게시물로 저장돼요.',
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
    back: '뒤로 가기',
    login: '로그인',
    profileEdit: '프로필 수정',
    logout: '로그아웃',
    excelDownload: '엑셀 다운로드',
    reset: '초기화',
    bookmarkOnly: '북마크한',
    myPosts: '내가 작성한',
    privateOnly: '나만 볼 수 있는',
    hideBots: '봇 글 숨기기',
    search: '검색',
    delete: '삭제',
    confirm: COMMON_TEXT.confirm,
    cancel: COMMON_TEXT.cancel,
  },
  auth: {
    title: '로그인',
    description: '아이디와 비밀번호를 입력해주세요.',
    guard: {
      title: '로그인이 필요한 서비스예요',
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
      // 이메일·닉네임 실시간 중복확인 문구 - 마이페이지(TEXTS.mypage.*)와 별개 화면이라 키를
      // 공유하지 않는다
      checking: '확인 중이에요...',
      emailAvailable: '사용 가능한 이메일이에요.',
      emailDuplicate: '이미 가입된 이메일이에요.',
      nicknameAvailable: '사용 가능한 닉네임이에요.',
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
    description: '닉네임과 프로필 이미지를 변경할 수 있어요.',
    save: '저장하기',
    changeImage: '이미지 변경',
    reopen: '다시 열기',
    checkingNickname: '확인 중...',
    nicknameAvailable: '사용 가능한 닉네임이에요.',
  },
  recentSearch: {
    title: '최근 검색',
    clearAll: '모두 지우기',
    empty: '최근 검색어가 없어요.',
    removeItem: '검색어 삭제',
  },
  post: {
    form: {
      create: {
        title: '링크 공유하기',
        description1: '팀원들과 공유하고 싶은 유용한 아티클이나 리소스의 URL을 입력하세요.',
        description2: '자동으로 제목과 이미지를 가져오고 태그를 생성해요.',
        urlLabel: 'URL',
        urlPlaceholder: 'https://example.com/amazing-article',
        titleLabel: POST_FORM_COMMON.titleLabel,
        titlePlaceholder: '제목 (비워두면 자동으로 가져와요)',
        categoryLabel: POST_FORM_COMMON.categoryLabel,
        bookmarkLabel: '북마크',
        bookmarkSelect: '폴더를 탭하면 선택돼요.',
        bookmarkNone: '북마크 안 함',
        privateLabel: POST_FORM_COMMON.privateLabel,
        privateDescription: POST_FORM_COMMON.privateDescription,
        submit: '링크 공유하기',
      },
      update: {
        title: '링크 수정하기',
        description: 'URL, 제목, 관심 분야, 공개 설정을 수정할 수 있어요.',
        urlLabel: 'URL',
        urlPlaceholder: 'https://example.com/amazing-article',
        urlChangedNotice: 'URL을 바꾸면 제목·설명·이미지·AI 요약을 새 링크에서 다시 가져와요.',
        titleLabel: POST_FORM_COMMON.titleLabel,
        titlePlaceholder: '제목 (비워두면 자동으로 가져와요)',
        categoryLabel: POST_FORM_COMMON.categoryLabel,
        privateLabel: POST_FORM_COMMON.privateLabel,
        privateDescription: POST_FORM_COMMON.privateDescription,
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
      visibilityConfirmMessage: (action: string) => `이 게시물을 ${action} 전환할까요?`,
    },
    detail: {
      notFound: '포스트를 찾을 수 없어요.',
      backToList: '목록으로',
    },
    search: {
      corrected: (query: string) => `'${query}'(으)로 검색한 결과예요.`,
      appliedCount: (count: number) => `조건 ${count}개 적용 중`,
      resetDisabledReason: '적용된 조건이 없어요',
    },
  },
  comment: {
    list: {
      loadError: '댓글을 불러오는데 실패했어요.',
      heading: '댓글',
      empty: '첫 번째 댓글을 남겨보세요!',
    },
    form: {
      replyPlaceholder: '답글을 작성하세요...',
      commentPlaceholder: '댓글을 작성하세요...',
      editPlaceholder: '수정할 내용을 입력하세요...',
      preview: '미리보기',
      removeImage: '이미지 삭제',
      attachImage: '이미지 첨부',
      dropHere: '이미지를 여기에 놓으세요',
      attachHint: '클릭·드래그·붙여넣기로 이미지 첨부',
      cancel: '취소',
      save: '저장',
      saving: COMMON_TEXT.saving,
      submitReply: '답글 등록',
      submitComment: '댓글 등록',
      showPreview: '미리보기 펼치기',
      hidePreview: '미리보기 접기',
      mobileBarTrigger: '댓글을 작성하세요...',
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
      selectorDescription: '폴더를 탭하면 바로 저장돼요.',
      recentSection: '최근 저장한 폴더',
      removeBookmark: '북마크 제거',
      viewAction: '보기',
      deleteConfirmTitle: (name: string) => `"${name}" 폴더 삭제`,
      deleteConfirmMessage:
        '이 폴더를 삭제할까요? 이 폴더에만 있던 북마크는 미분류로 이동해요. (다른 폴더에도 있으면 그대로 유지돼요)',
      sort: {
        latest: '최신 북마크순',
        oldest: '오래된순',
        title: '제목순',
        views: '조회수순',
        viewed: '최근 열람순',
      },
    },
  },
  errors: {
    notFound: {
      title: '페이지를 찾을 수 없어요',
      description: '요청하신 페이지가 존재하지 않거나 삭제됐어요.',
    },
    forbidden: {
      title: '접근 권한이 없어요',
      description: '요청하신 페이지에 접근할 수 없어요.',
    },
    serverError: {
      description: '서버에 문제가 발생했어요. 잠시 후 다시 시도해주세요.',
    },
    unexpected: {
      title: '문제가 발생했어요',
      description: '일시적인 오류로 화면을 표시하지 못했어요. 잠시 후 다시 시도해주세요.',
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
    urlFormat: '유효하지 않은 URL 형식이에요.',
    urlRequired: 'URL을 입력해주세요.',
    contentRequired: '내용을 입력해주세요.',
    titleRequired: '제목을 입력해주세요.',
    idRequired: '아이디를 입력해주세요.',
    passwordRequired: '비밀번호를 입력해주세요.',
    passwordRegex: '비밀번호는 8자 이상, 영문, 숫자, 특수문자 조합으로 입력해주세요.',
    passwordMaxLength: '비밀번호는 20자 이하로 입력해주세요.',
    emailRegex: '올바른 이메일 형식(예: user@mail.com)인지 확인해주세요.',
    // "닉네임" 레이블 바로 옆(같은 줄, 오른쪽 정렬)에 뜨는 메시지라 "닉네임은" 주어를 반복하지
    // 않고 짧게 쓴다 - 길면 라벨과 한 줄에 안 들어가 줄바꿈되면서 레이아웃이 밀린다.
    nicknameLength: '2자 이상 20자 이하로 입력해주세요.',
    nicknameCharset: '한글·영문·숫자·_ . -만 사용해주세요.',
    folderNameRequired: '폴더 이름을 입력해주세요.',
    categoryNameRequired: '카테고리 이름을 입력해주세요.',
    categorySlugRequired: '카테고리 슬러그를 입력해주세요.',
    invalidIdFormat: '유효하지 않은 ID 형식이에요.',
    commentOrImageRequired: '내용 또는 이미지를 추가해주세요.',
    commentRequired: '댓글에 내용 또는 이미지를 추가해주세요.',
    replyRequired: '답글에 내용 또는 이미지를 추가해주세요.',
    noChanges: '변경한 내용이 없어요.',
    imageTooLarge: (maxSizeMB: number) => `이미지 용량은 ${maxSizeMB}MB를 초과할 수 없어요.`,
    imageCountExceeded: (max: number) => `이미지는 최대 ${max}장까지 첨부할 수 있어요.`,
    imageFileOnly: '이미지 파일만 첨부할 수 있어요.',
  },
  messages: {
    info: {
      noData: '조회할 데이터가 없어요.',
      noPosts: '등록된 링크가 없거나 검색 결과가 없어요.',
    },
    warning: {
      memberDeleteConfirm: '정말 이 회원을 삭제할까요? 삭제된 데이터는 복구할 수 없어요.',
      postDeleteConfirm: '정말 이 포스트를 삭제할까요? 삭제된 데이터는 복구할 수 없어요.',
      commentDeleteConfirm: '정말 이 댓글을 삭제할까요? 삭제된 데이터는 복구할 수 없어요.',
    },
    success: {
      accountCreated: '가입을 완료했어요.',
      postCreated: '포스트를 생성했어요.',
      postUpdated: '포스트를 수정했어요.',
      linkCopied: '링크를 복사했어요.',
      originalLinkCopied: '원본 링크를 복사했어요.',
      bookmarkSavedTo: (folderName: string) => `${folderName}에 저장했어요.`,
      bookmarkRemovedFromFolder: (folderName: string) => `${folderName} 폴더에서 제거했어요.`,
      bookmarkClearedAllFolders: '모든 폴더에서 제거했어요.',
      bookmarkAutoUncategorizedDescription: '마지막 폴더에서 제거되어 미분류로 이동했어요.',
    },
    error: {
      // 공통
      defaultError: '오류가 발생했어요.',
      serverError: '서버 오류가 발생했어요.',
      unknownError: '알 수 없는 오류가 발생했어요.',
      apiRequestFailed: 'API 요청 실패', // 콘솔 로그 전용 - 톤 규칙 대상 아님
      loginRequired: '로그인이 필요해요.',

      // 인증 관련
      unauthorizedAccessToken: '액세스 토큰이 유효하지 않아요.',
      unauthorizedRefreshToken: '리프레시 토큰이 유효하지 않아요.',
      loginFailed: '로그인에 실패했어요.',
      loginFailedPasswordMismatch: '아이디 또는 비밀번호가 일치하지 않아요.',
      logoutError: '로그아웃 처리 중 오류가 발생했어요.',
      tokenRefreshFailed: '토큰 갱신 실패', // 콘솔 로그 전용 - 톤 규칙 대상 아님
      authRestoreFailed: '인증 복원에 실패했어요.',
      loginError: '로그인에 실패했어요.',
      userInfoNotFound: '사용자 정보를 찾을 수 없어요.',
      fetchAccount: '계정 정보 조회에 실패했어요.',
      accountCreateFailed: '계정 생성에 실패했어요.',
      accountCreateFailedDuplicateAccount: '해당 이메일로 가입된 계정이 존재해요.',
      accountUpdateFailed: '프로필 업데이트에 실패했어요.',
      nicknameDuplicate: '이미 사용 중인 닉네임이에요.',
      avatarUploadFailed: '이미지 업로드에 실패했어요.',

      // 포스트 관련
      postCreateFailed: '포스트 생성에 실패했어요.',
      postUpdateFailed: '포스트 수정에 실패했어요.',
      fetchPosts: '포스트를 불러오는 중 오류가 발생했어요.',
      postDeleteFailed: '포스트 삭제에 실패했어요.',
      postVisibilityUpdateFailed: '게시물 공개 설정 변경에 실패했어요.',

      // 북마크 폴더 관련
      folderRenameFailed: '이름 변경에 실패했어요.',
      folderDeleteFailed: '폴더 삭제에 실패했어요.',
      folderCreateFailed: '폴더 생성에 실패했어요.',
      folderCreateFailedFull: '폴더 생성에 실패했어요.',
      bookmarkSaveFailed: '저장에 실패했어요.',
      bookmarkRemoveFailed: '북마크 제거에 실패했어요.',
      bookmarkRemoveFromFolderFailed: '폴더에서 제거하지 못했어요.',

      // 권한 관련
      accessDenied: '접근 권한이 없어요.',

      // 앱 초기화
      appInitFailed: '앱 초기화 실패:', // 콘솔 로그 전용 - 톤 규칙 대상 아님

      // 유틸
      linkCopyFailed: '링크 복사에 실패했어요.',
    },
  },
  unsavedChanges: {
    title: '작성 중인 내용이 있어요',
    message: '이 페이지를 벗어나면 입력한 내용이 사라져요. 그래도 나갈까요?',
    confirm: '나가기',
    cancel: '계속 작성',
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
    imageZoom: '이미지 확대',
    imageViewer: '확대된 이미지',
    imageViewerDescription: '바깥 영역이나 닫기 버튼을 클릭하면 닫혀요.',
    imageViewerPrev: '이전 이미지',
    imageViewerNext: '다음 이미지',
    profileImageZoom: '프로필 사진 확대',
    commentBarExpand: '댓글 작성창 펼치기',
    scrollToCommentForm: '댓글 작성창으로 이동',

    // 입력 필드
    inputClear: '입력값 지우기',

    // 북마크 폴더
    folderMenu: '폴더 메뉴',
    close: '닫기',
    backToFolderList: '폴더 목록으로',
    bookmarkChange: '북마크 폴더 변경',
    bookmarkSave: '북마크 저장',

    // 게시글 검색 필터
    postCategoryFilters: '카테고리 검색 태그',
    postScopeFilters: '게시글 범위 필터',
  },
} as const;
