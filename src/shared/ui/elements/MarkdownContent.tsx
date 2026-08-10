import React from 'react';
import { cn } from '@/shared/lib/tailwind/utils';
import { useImageViewerStore } from '@/shared/ui/elements/modal/image-viewer/imageViewer.store';
import { NavigationService } from '@/shared/lib/router/navigation';
import { TEXTS } from '@/shared/config/texts';
import { getTransformedImageUrl } from '@/shared/lib/image/supabaseImage';

interface MarkdownContentProps {
  content: string;
  isMobile?: boolean;
  className?: string;
}

const URL_PATTERN = /(blob:https?:\/\/[^\s]+|https?:\/\/[^\s]+)/g;
const IMAGE_EXT_PATTERN = /\.(jpeg|jpg|gif|png|webp|avif|heic|heif)(\?.*)?$/i;

function isImageUrl(url: string): boolean {
  // blob: URL은 낙관적으로 삽입한 임시 댓글이 업로드 전 이미지를 미리 보여줄 때만 등장한다
  // (아직 서버에 없는 파일이라 http(s) URL이 아님) - 서버 응답이 오면 실제 URL로 교체된다.
  return url.startsWith('blob:') || IMAGE_EXT_PATTERN.test(url);
}

/**
 * content 전체에서 이미지로 렌더링될 URL만 순서대로 뽑는다. 라이트박스에 "같은 댓글의 다른
 * 이미지들"을 함께 넘겨 이전/다음 네비게이션이 가능하게 하려면, 클릭 시점에 이 댓글에 이미지가
 * 총 몇 개인지 미리 알아야 한다.
 */
function extractImageUrls(content: string): string[] {
  const matches = content.match(URL_PATTERN) ?? [];
  return matches.filter(isImageUrl);
}

export function MarkdownContent({ content, isMobile = false, className }: MarkdownContentProps) {
  if (!content) {
    return null;
  }
  const imageUrls = extractImageUrls(content);
  return (
    <div className={cn('leading-relaxed break-all', className)}>
      {parseMarkdown(content, isMobile, imageUrls)}
    </div>
  );
}

function renderInlineLinks(
  text: string,
  keyPrefix: string,
  isMobile: boolean,
  imageUrls: string[]
): React.ReactNode[] {
  const parts = text.split(URL_PATTERN);
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, i) => {
    if (!part) {
      return;
    }
    if (/^(blob:https?:\/\/[^\s]+|https?:\/\/[^\s]+)$/.test(part)) {
      if (isImageUrl(part)) {
        nodes.push(
          <button
            key={`${keyPrefix}-${i}`}
            type="button"
            onClick={() => {
              // renderInlineLinks는 훅을 쓸 수 없는 일반 함수라 히스토리 오버레이를
              // NavigationService로 직접 연다 (auth.queries.ts의 마이페이지 재오픈과 동일한 이유)
              const images = imageUrls.map((url) => ({ src: url, alt: 'attachment' }));
              const startIndex = Math.max(imageUrls.indexOf(part), 0);
              useImageViewerStore.getState().setImages(images, startIndex);
              NavigationService.navigate(`${window.location.pathname}${window.location.search}`, {
                state: { imageViewerOpen: true },
                preventScrollReset: true,
              });
            }}
            className="block cursor-pointer"
            aria-label={TEXTS.ariaLabels.imageZoom}
          >
            <img
              src={getTransformedImageUrl(part, { width: 800 })}
              alt="attachment"
              className="max-w-full max-h-60 rounded-md my-2 object-contain"
            />
          </button>
        );
      } else {
        nodes.push(
          <a
            key={`${keyPrefix}-${i}`}
            href={part}
            target={isMobile ? '_self' : '_blank'}
            rel={!isMobile ? 'noopener noreferrer' : undefined}
            className="text-info hover:text-info/80 hover:underline transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
    } else {
      nodes.push(<React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>);
    }
  });

  return nodes;
}

function parseMarkdown(text: string, isMobile: boolean, imageUrls: string[]): React.ReactNode[] {
  if (!text) {
    return [];
  }
  const elements: React.ReactNode[] = [];

  // 닫힌 코드 블럭(``` ... ```)과 나머지 텍스트를 분리
  const segments = text.split(/(```[\s\S]*?```)/g);

  segments.forEach((segment, segIndex) => {
    // 닫힌 코드 블럭
    if (segment.startsWith('```') && segment.endsWith('```') && segment.length > 6) {
      const inner = segment.slice(3, -3);
      const newlineIdx = inner.indexOf('\n');
      // 첫 줄이 언어 힌트(```js 등)이면 제거
      const code = newlineIdx !== -1 ? inner.slice(newlineIdx + 1) : inner;

      elements.push(
        <pre
          key={`seg-${segIndex}`}
          className="bg-muted rounded-md p-3 my-2 text-xs overflow-x-auto font-mono whitespace-pre"
        >
          <code>{code}</code>
        </pre>
      );
      return;
    }

    // 줄 단위로 헤딩 / 일반 텍스트 처리 (개행: LF, CRLF, CR 모두 처리)
    segment.split(/\r\n|\r|\n/).forEach((line, lineIndex) => {
      const key = `${segIndex}-${lineIndex}`;

      if (line.startsWith('#### ')) {
        elements.push(
          <h4 key={key} className="text-sm font-bold mt-1">
            {renderInlineLinks(line.slice(5), key, isMobile, imageUrls)}
          </h4>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={key} className="text-sm font-semibold mt-1">
            {renderInlineLinks(line.slice(4), key, isMobile, imageUrls)}
          </h3>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={key} className="text-base font-bold mt-1">
            {renderInlineLinks(line.slice(3), key, isMobile, imageUrls)}
          </h2>
        );
      } else if (line.startsWith('# ')) {
        elements.push(
          <h1 key={key} className="text-base font-bold mt-1">
            {renderInlineLinks(line.slice(2), key, isMobile, imageUrls)}
          </h1>
        );
      } else if (line === '') {
        elements.push(<br key={key} />);
      } else {
        elements.push(
          <span key={key} className="block">
            {renderInlineLinks(line, key, isMobile, imageUrls)}
          </span>
        );
      }
    });
  });

  return elements;
}
