import { describe, expect, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 시험 이벤트·판정 규칙을 여기서 검증한다(선례: precompress-assets.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { buildTestEvent, findMismatches } from '../../../scripts/lib/cloudfront-function-deploy.js';

describe('buildTestEvent', () => {
  it('viewer-request는 요청만 담고, acceptEncoding이 없으면 헤더가 비어 있다', () => {
    const event = buildTestEvent('viewer-request', { uri: '/post/abc' });

    expect(event).toMatchObject({
      version: '1.0',
      context: { eventType: 'viewer-request' },
      request: { method: 'GET', uri: '/post/abc', headers: {} },
    });
    expect(event).not.toHaveProperty('response');
  });

  it('acceptEncoding을 주면 accept-encoding 헤더로 넣는다', () => {
    const event = buildTestEvent('viewer-request', { uri: '/a.js', acceptEncoding: 'br' });

    expect(event).toMatchObject({ request: { headers: { 'accept-encoding': { value: 'br' } } } });
  });

  it('userAgent를 주면 user-agent 헤더로 넣고, accept-encoding과 함께 줄 수 있다', () => {
    const event = buildTestEvent('viewer-request', {
      uri: '/post/abc',
      acceptEncoding: 'br',
      userAgent: 'Slackbot-LinkExpanding 1.0',
    });

    expect(event).toMatchObject({
      request: {
        headers: {
          'accept-encoding': { value: 'br' },
          'user-agent': { value: 'Slackbot-LinkExpanding 1.0' },
        },
      },
    });
  });

  it('viewer-response는 200 응답과 오리진 헤더를 함께 담는다', () => {
    const event = buildTestEvent('viewer-response', {
      uri: '/a.js.br',
      responseHeaders: { vary: 'Origin' },
    });

    expect(event).toMatchObject({
      context: { eventType: 'viewer-response' },
      response: { statusCode: 200, headers: { vary: { value: 'Origin' } } },
    });
  });
});

describe('findMismatches', () => {
  it('test-function 출력({ request })과 handler 반환값을 둘 다 판정한다', () => {
    const testCase = { expect: { uri: '/index.html' } };

    expect(findMismatches(testCase, { request: { uri: '/index.html' } })).toEqual([]);
    expect(findMismatches(testCase, { uri: '/index.html' })).toEqual([]);
  });

  it('uri가 다르면 기대와 실제를 알려 준다', () => {
    expect(
      findMismatches({ expect: { uri: '/index.html' } }, { request: { uri: '/404.html' } })
    ).toEqual(['uri: 기대 /index.html, 실제 /404.html']);
  });

  it('상태·헤더 값·없어야 하는 헤더를 각각 본다', () => {
    const testCase = {
      expect: { statusCode: 404, headers: { vary: 'Accept-Encoding' }, absentHeaders: ['x-extra'] },
    };
    const output = {
      response: {
        statusCode: 200,
        headers: { vary: { value: 'Origin' }, 'x-extra': { value: '1' } },
      },
    };

    expect(findMismatches(testCase, output)).toEqual([
      'statusCode: 기대 404, 실제 200',
      '헤더 vary: 기대 Accept-Encoding, 실제 Origin',
      '헤더 x-extra: 없어야 하는데 1',
    ]);
  });

  it('기대한 헤더가 아예 없으면 실패로 본다', () => {
    expect(
      findMismatches(
        { expect: { headers: { vary: 'Accept-Encoding' } } },
        { response: { headers: {} } }
      )
    ).toEqual(['헤더 vary: 기대 Accept-Encoding, 실제 undefined']);
  });
});
