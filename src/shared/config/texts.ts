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
  titleLabel: '제목 (선택사항)',
  categoryLabel: '관심 분야 (선택사항)',
  privateLabel: '나만 보기 (비공개)',
  privateDescription: '체크하면 다른 사람에게 공개되지 않고 나만 볼 수 있는 게시물로 저장돼요.',
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
    currentPassword: '현재 비밀번호',
    newPassword: '새 비밀번호',
    confirmPassword: '비밀번호 확인',
    message: '메시지',
  },
  placeholders: {
    nickname: '한글/영문 2~20자 이내',
    email: 'example@email.com',
    password: '비밀번호 입력',
    confirmPassword: '비밀번호를 다시 입력하세요',
    message: '메시지를 입력하세요.',
    postSearch: '키워드나 @카테고리, #닉네임으로 검색',
    bookmarkSearch: '북마크 내 검색',
  },
  buttons: {
    retry: '다시 시도',
    refresh: '새로고침',
    home: '홈으로 이동',
    back: '뒤로가기',
    login: '로그인',
    myComments: '내 댓글',
    accountSettings: '계정 설정',
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
      title: 'LinkSphere에 오신 걸 환영해요',
      subtitle: '링크를 공유하고 발견해보세요.',
      signingIn: '로그인 중...',
      signIn: '로그인',
      noAccount: '계정이 없으신가요?',
      signUp: '회원가입',
      forgotPassword: '비밀번호를 잊으셨나요?',
    },
    signup: {
      title: '계정 만들기',
      subtitle: 'LinkSphere에 가입하고 링크 공유를 시작해보세요.',
      signingUp: '가입 중...',
      signUp: '회원가입',
      alreadyAccount: '이미 계정이 있으신가요?',
      signIn: '로그인',
      // 이메일·닉네임 실시간 중복확인 문구 - 프로필 수정 섹션(TEXTS.mypage.*)과 별개
      // 화면이라 키를 공유하지 않는다
      checking: '확인 중이에요...',
      emailAvailable: '사용 가능한 이메일이에요.',
      emailDuplicate: '이미 가입된 이메일이에요.',
      nicknameAvailable: '사용 가능한 닉네임이에요.',
      checkEmailTitle: '가입을 완료했어요',
      checkEmailDescription:
        '입력하신 이메일로 인증 메일을 보냈어요. 메일함에서 링크를 확인해주세요.',
      goToLogin: '로그인하러 가기',
    },
    forgotPassword: {
      title: '비밀번호를 잊으셨나요?',
      subtitle: '이메일을 입력하면 재설정 링크를 보내드려요.',
      submitting: '전송 중...',
      submit: '재설정 링크 보내기',
      backToLogin: '로그인으로 돌아가기',
      checkEmailTitle: '메일함을 확인해주세요',
      // "비밀번호 재설정"을 한 덩어리로 읽히게 하려고 여기서 줄을 바꾼다(CardDescription에서
      // <br/>로 연결 - CreatePostForm.tsx의 description1/2와 같은 패턴)
      checkEmailDescription1: '해당 이메일로 가입된 계정이 있다면 비밀번호 재설정',
      checkEmailDescription2: '링크를 보내드렸어요.',
      checkSpamHint: '스팸함이나 프로모션함도 확인해보세요.',
      resendPrompt: '메일이 안 왔나요',
      resend: '다시 보내기',
    },
    resetPassword: {
      title: '비밀번호 재설정',
      subtitle: '새 비밀번호를 입력해주세요.',
      submitting: '재설정 중...',
      submit: '비밀번호 재설정',
      backToLogin: '로그인으로 돌아가기',
      invalidTokenTitle: '유효하지 않은 링크예요',
      invalidTokenDescription: '이 재설정 링크는 유효하지 않거나 만료됐어요.',
      // "다시 요청해주세요"가 문장 끝에서 잘려 다음 줄로 넘어가면 뜻이 끊겨 보여 별도
      // 키로 분리했다 - 컴포넌트에서 whitespace-nowrap으로 묶어 렌더링한다
      // (docs/DECISIONS.md 2026-08-13, "등록 중..." 배지가 "등록"/"중..."으로 쪼개졌던
      // 사고와 같은 이유 - 짧은 행동 유도 문구는 중간에 끊기면 안 된다).
      invalidTokenRetryPrompt: '다시 요청해주세요.',
      requestNewLink: '새 링크 요청하기',
    },
    verifyEmail: {
      pendingTitle: '이메일을 확인하고 있어요',
      successTitle: '이메일 인증이 완료됐어요',
      successDescription: '이제 글쓰기와 댓글 작성을 자유롭게 이용할 수 있어요.',
      errorTitle: '인증에 실패했어요',
      errorDescription: '링크가 유효하지 않거나 이미 사용됐어요.',
      goToFeed: '피드로 이동',
      goToLogin: '로그인하러 가기',
      goToAccountSettings: '계정 설정으로 이동',
    },
  },
  nav: {
    brand: 'LinkSphere',
    feed: 'Feed',
    submit: 'Submit',
    bookmark: 'Bookmark',
    logIn: '로그인',
    logOut: '로그아웃',
    loggingOut: '로그아웃 중...',
    toggleMenu: '메뉴 토글',
    toggleSearch: '검색 토글',
    toggleTheme: '테마 토글',
    saving: COMMON_TEXT.saving,
  },
  mypage: {
    title: '프로필 수정',
    description: '닉네임과 프로필 이미지를 변경할 수 있어요.',
    save: '저장하기',
    changeImage: '이미지 변경',
    checkingNickname: '확인 중...',
    nicknameAvailable: '사용 가능한 닉네임이에요.',
  },
  accountSettings: {
    title: '계정 설정',
    emailVerificationNeeded:
      '이메일 인증이 필요해요. 글쓰기·댓글쓰기를 하려면 인증을 완료해주세요.',
    emailVerificationResend: '인증 메일 다시 보내기',
    emailVerificationResending: '보내는 중...',
    passwordSectionTitle: '비밀번호 변경',
    changePasswordSubmit: '비밀번호 변경',
    changePasswordSubmitting: '변경 중...',
    deleteSectionTitle: '회원 탈퇴',
    // 14는 BE AccountDeletionService.GRACE_PERIOD(link-sphere_BE_NEW)와 반드시 같은 값이어야
    // 한다 - 자동 동기화 장치는 없으므로 그쪽을 바꾸면 이 문구도 같이 바꾼다.
    deleteSectionDescription:
      '탈퇴를 신청하면 바로 로그아웃되고, 작성한 글과 댓글은 "탈퇴한 사용자"로 표시돼요. 14일 안에 다시 로그인하면 탈퇴가 취소돼요. 14일이 지나면 북마크·좋아요·조회 기록이 삭제되고 되돌릴 수 없어요.',
    deleteSubmit: '회원 탈퇴',
    deleteSubmitting: '탈퇴 중...',
    deleteConfirmMessage: '정말 탈퇴하시겠어요? 14일 안에 다시 로그인하면 취소할 수 있어요.',
  },
  version: {
    title: '배포 확인',
    description: '지금 이 탭이 실행 중인 빌드와 서버에 배포된 빌드를 비교해요.',
    loadedBuild: '이 탭이 실행 중인 빌드',
    deployedBuild: '서버에 배포된 빌드',
    entryScript: '진입 스크립트',
    deployedAt: '배포 시각',
    runNumber: '워크플로우 실행 번호',
    devModeNotice: '개발 서버에는 /version.json이 없어 서버 빌드를 확인할 수 없어요.',
    checkFailedNotice: '서버 빌드 정보를 불러오지 못했어요.',
    bannerMatch: '최신 배포와 동기화됐어요.',
    bannerMismatch: '배포와 달라요. 새로고침하면 최신으로 바뀌어요.',
    viewChanges: '변경된 커밋 보기',
    viewChangelog: '변경 이력 보기',
    reload: '새로고침',
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
        description1: '공유하고 싶은 유용한 아티클이나 리소스의 URL을 입력하세요.',
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
        // 제목만 비운 경우는 제목만 다시 가져온다(설명·태그·AI 요약은 그대로) - BE updatePost 참고.
        titleClearedNotice:
          '제목을 비우면 링크에서 제목을 다시 가져와요. 가져오지 못하면 기존 제목이 유지돼요.',
        titleLabel: POST_FORM_COMMON.titleLabel,
        titlePlaceholder: '제목 (비워두면 자동으로 가져와요)',
        categoryLabel: POST_FORM_COMMON.categoryLabel,
        privateLabel: POST_FORM_COMMON.privateLabel,
        privateDescription: POST_FORM_COMMON.privateDescription,
        update: '수정하기',
      },
    },
    card: {
      // 댓글(CommentAuthor, BE가 채워주는 "탈퇴한 사용자")과 표시를 통일한다 - 예전엔
      // 게시글만 "Anonymous"로 따로 표시됐다(2026-09-29 발견한 불일치).
      withdrawnAuthor: '탈퇴한 사용자',
      visitWebsite: 'Visit Website',
      aiSummary: 'AI 요약',
      semanticMatch: '검색어와 의미가 비슷한 글이에요',
      makePublic: '전체 공개로 전환',
      makePrivate: '비공개로 전환',
      edit: '수정',
      publicLabel: '전체 공개',
      privateLabel: '나만 보기',
      saving: COMMON_TEXT.saving,
      metadataUnavailable: '이 링크의 정보를 가져오지 못했어요.',
      copyOriginalLink: '원본 링크 복사',
      visibilityConfirmTitle: '공개 설정 변경',
      visibilityToPublic: '전체 공개로',
      visibilityToPrivate: '나만 보기(비공개)로',
      visibilityConfirmMessage: (action: string) => `이 게시물을 ${action} 전환할까요?`,
      // 확인창 버튼 전용 짧은 문구 - 메시지의 action(괄호 설명 포함)과 달리 버튼은 좁아서
      // 괄호 없이 결과만 말한다. "확인"만으로는 버튼을 안 보고 메시지를 읽어야만 무엇을
      // 확정하는지 알 수 있었다(2026-09-29, 버튼 문구 규칙 정립).
      visibilityConfirmButtonToPublic: '전체 공개로 전환',
      visibilityConfirmButtonToPrivate: '나만 보기로 전환',
    },
    detail: {
      notFound: '포스트를 찾을 수 없어요.',
      // 유입 경로별로 실제 목적지가 달라 라벨을 그때그때 고른다 (PostDetailPage 참고).
      // backToList: 피드·검색 유입, 외부(공유링크·FCM·새로고침) 유입 — 실제로 /post로 감,
      //   이름 있는 화면(포스트 목록)이라 약속할 수 있다.
      // 그 외(북마크 - 폴더마다 화면이 달라 하나로 이름 붙일 수 없음, 상세 자기 링크 등
      //   출처 불명)는 목적지를 약속하지 않는 공용 문구 buttons.back을 쓴다.
      backToList: '목록으로',
    },
    search: {
      corrected: (query: string) => `'${query}'(으)로 검색한 결과예요.`,
      appliedCount: (count: number) => `조건 ${count}개 적용 중`,
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
    myList: {
      pageTitle: '내 댓글',
      empty: '아직 작성한 댓글이 없어요.',
      loadError: '내 댓글을 불러오는데 실패했어요.',
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
      selectorTitle: '북마크에 저장',
      selectorDescription: '폴더를 탭하면 바로 저장돼요.',
      recentSection: '최근 저장한 폴더',
      removeBookmark: '북마크 제거',
      viewAction: '보기',
      undoAction: '되돌리기',
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
    passwordGuide: '영문, 숫자, 특수문자 조합 8~64자',
  },
  validation: {
    urlFormat: 'http:// 또는 https://로 시작하는 웹 주소만 등록할 수 있어요.',
    urlRequired: 'URL을 입력해주세요.',
    contentRequired: '내용을 입력해주세요.',
    titleRequired: '제목을 입력해주세요.',
    idRequired: '아이디를 입력해주세요.',
    passwordRequired: '비밀번호를 입력해주세요.',
    passwordRegex: '비밀번호는 8자 이상, 영문, 숫자, 특수문자 조합으로 입력해주세요.',
    passwordMaxLength: '비밀번호는 64자 이하로 입력해주세요.',
    passwordAsciiOnly: '비밀번호에는 한글이나 이모지를 사용할 수 없어요.',
    passwordMismatch: '비밀번호가 일치하지 않아요.',
    tokenRequired: '유효하지 않은 링크예요. 다시 요청해주세요.',
    emailRegex: '올바른 이메일 형식(예: user@mail.com)인지 확인해주세요.',
    // "닉네임" 레이블 바로 옆(같은 줄, 오른쪽 정렬)에 뜨는 메시지라 "닉네임은" 주어를 반복하지
    // 않고 짧게 쓴다 - 길면 라벨과 한 줄에 안 들어가 줄바꿈되면서 레이아웃이 밀린다.
    nicknameLength: '2자 이상 20자 이하로 입력해주세요.',
    nicknameCharset: '한글·영문·숫자·_ . -만 사용해주세요.',
    folderNameRequired: '폴더 이름을 입력해주세요.',
    categoryNameRequired: '카테고리 이름을 입력해주세요.',
    invalidIdFormat: '유효하지 않은 ID 형식이에요.',
    commentOrImageRequired: '내용 또는 이미지를 추가해주세요.',
    commentRequired: '댓글에 내용 또는 이미지를 추가해주세요.',
    replyRequired: '답글에 내용 또는 이미지를 추가해주세요.',
    commentContentTooLong: '댓글은 한글 2,000자까지 작성할 수 있어요.',
    commentPayloadTooLarge:
      '댓글 용량이 너무 커요. 줄바꿈을 줄이거나 이미지를 줄여서 다시 시도해주세요.',
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
      postCreated: '포스트를 생성했어요.',
      postUpdated: '포스트를 수정했어요.',
      postSetToPrivate: '이 게시물을 나만 보기로 전환했어요.',
      postSetToPublic: '이 게시물을 전체 공개로 전환했어요.',
      accountUpdated: '프로필을 수정했어요.',
      linkCopied: '링크를 복사했어요.',
      originalLinkCopied: '원본 링크를 복사했어요.',
      bookmarkSavedTo: (folderName: string) => `${folderName}에 저장했어요.`,
      bookmarkRemovedFromFolder: (folderName: string) => `${folderName} 폴더에서 제거했어요.`,
      bookmarkClearedAllFolders: '모든 폴더에서 제거했어요.',
      bookmarkRemovedWithLastFolderDescription: '마지막 폴더라서 북마크도 함께 제거했어요.',
      bookmarkRemoved: '북마크를 제거했어요.',
      passwordResetConfirmed: '비밀번호를 재설정했어요.',
      passwordChanged: '비밀번호를 변경했어요.',
      accountDeleted: '탈퇴를 신청했어요. 14일 안에 다시 로그인하면 취소돼요.',
      // 유예 중(탈퇴 신청 후 14일 이내) 로그인 성공 시 표시 - useLoginMutation의
      // onSuccess에서 로그인 응답의 deletionCancelled로 판단한다.
      accountDeletionCancelled: '탈퇴 신청이 취소됐어요. 다시 오신 걸 환영해요.',
      emailVerificationResent: '인증 메일을 다시 보냈어요.',
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
      passwordResetRequestFailed: '요청 처리에 실패했어요. 잠시 후 다시 시도해주세요.',
      passwordResetConfirmFailed: '비밀번호 재설정에 실패했어요.',
      passwordResetTokenInvalid: '유효하지 않거나 만료된 링크예요. 다시 요청해주세요.',
      passwordChangeFailed: '비밀번호 변경에 실패했어요.',
      currentPasswordMismatch: '현재 비밀번호가 일치하지 않아요.',
      accountDeleteFailed: '계정 삭제에 실패했어요.',
      emailVerificationRequestFailed: '요청 처리에 실패했어요. 잠시 후 다시 시도해주세요.',
      emailVerificationRequired:
        '이메일 인증이 필요해요. 계정 설정에서 인증 메일을 다시 보낼 수 있어요.',

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
      bookmarkRestoreFailed: '되돌리지 못했어요.',

      // 권한 관련
      accessDenied: '접근 권한이 없어요.',

      // 보안 정책(CloudFront/WAF)에 앱 도달 전 차단된 경우
      edgeBlocked:
        '요청이 보안 정책에 막혔어요. 내용이 너무 길거나 허용되지 않는 문자가 포함됐을 수 있어요.',

      // 앱 초기화
      appInitFailed: '앱 초기화 실패:', // 콘솔 로그 전용 - 톤 규칙 대상 아님

      // 유틸
      linkCopyFailed: '링크 복사에 실패했어요.',
      imageUploadFailed: '이미지 업로드에 실패했어요.',
    },
  },
  unsavedChanges: {
    title: '작성 중인 내용이 있어요',
    message: '이 페이지를 벗어나면 입력한 내용이 사라져요. 그래도 나갈까요?',
    confirm: '나가기',
    cancel: '계속 작성',
    signup: {
      title: '회원가입을 그만둘까요?',
      message: '지금 나가면 입력한 가입 정보가 사라져요.',
      confirm: '나가기',
      cancel: '계속 가입하기',
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
    accountMenu: '계정 메뉴',
    accountMenuUnverified: '계정 메뉴 (이메일 인증 필요)',
    logout: '로그아웃',
    saveEmail: '이메일 저장',
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
    bookmarkSortSelect: '북마크 정렬 기준 선택',

    // 게시글 상호작용
    postLike: '좋아요',
    postUnlike: '좋아요 취소',
    postMenu: '게시글 메뉴',

    // 게시글 검색 필터
    postCategoryFilters: '카테고리 검색 태그',
    postCategoryFilterBy: (name: string) => `${name} 카테고리 글 보기`,
    postScopeFilters: '게시글 범위 필터',
  },
} as const;
