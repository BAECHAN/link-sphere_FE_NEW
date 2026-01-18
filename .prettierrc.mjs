export default {
  // arrowParens: 화살표 함수의 매개변수에 괄호를 사용할지 여부
  // always: 항상 괄호 사용 (x) => x
  arrowParens: 'always',

  // bracketSpacing: 객체 리터럴의 중괄호 사이에 공백 넣기
  // true: { foo: bar }
  bracketSpacing: true,

  // endOfLine: 줄 끝 문자 설정
  // lf: Unix 스타일 줄바꿈 (Linux, macOS)
  endOfLine: 'lf',

  // htmlWhitespaceSensitivity: HTML 파일에서 공백 처리 방식
  // css: CSS display 속성에 따라 처리
  htmlWhitespaceSensitivity: 'css',

  // insertPragma: 파일 상단에 Prettier 포맷 주석 추가 여부
  // false: 주석 추가 안 함
  insertPragma: false,

  // singleAttributePerLine: HTML/JSX 태그에서 속성을 한 줄에 하나씩 배치
  // false: 여러 속성을 한 줄에 배치 가능
  singleAttributePerLine: false,

  // bracketSameLine: JSX/HTML 태그의 닫는 괄호 위치
  // false: 닫는 괄호를 다음 줄에 배치
  bracketSameLine: false,

  // jsxSingleQuote: JSX에서 작은따옴표 사용
  // true: <div className='foo' />
  jsxSingleQuote: false,

  // printWidth: 줄 길이 제한
  // 100: 한 줄에 최대 100자
  printWidth: 100,

  // proseWrap: 마크다운 파일에서 줄바꿈 처리
  // preserve: 원본 줄바꿈 유지
  proseWrap: 'preserve',

  // quoteProps: 객체 속성에 따옴표 사용 규칙
  // as-needed: 필요한 경우에만 따옴표 사용
  quoteProps: 'as-needed',

  // requirePragma: Prettier 주석이 있는 파일만 포맷
  // false: 모든 파일 포맷
  requirePragma: false,

  // semi: 명령문 끝에 세미콜론 추가
  // true: 세미콜론 사용
  semi: true,

  // singleQuote: 큰따옴표 대신 작은따옴표 사용
  // true: 'string'
  singleQuote: true,

  // tabWidth: 들여쓰기 간격
  // 2: 2칸 들여쓰기
  tabWidth: 2,

  // trailingComma: 후행 쉼표 사용
  // es5: ES5에서 유효한 곳에만 후행 쉼표 (객체, 배열)
  trailingComma: 'es5',

  // useTabs: 스페이스 대신 탭 사용
  // false: 스페이스 사용
  useTabs: false,
};
