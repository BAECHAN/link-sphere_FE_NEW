import React from 'react';
import { cn } from '@/shared/lib/tailwind/utils';

interface MarkdownContentProps {
  content: string;
  isMobile?: boolean;
  className?: string;
}

export function MarkdownContent({ content, isMobile = false, className }: MarkdownContentProps) {
  if (!content) return null;
  return (
    <div className={cn('leading-relaxed break-all', className)}>
      {parseMarkdown(content, isMobile)}
    </div>
  );
}

function renderInlineLinks(text: string, keyPrefix: string, isMobile: boolean): React.ReactNode[] {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, i) => {
    if (!part) return;
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      const isImage = /\.(jpeg|jpg|gif|png|webp|avif|heic|heif)(\?.*)?$/i.test(part);
      if (isImage) {
        nodes.push(
          <img
            key={`${keyPrefix}-${i}`}
            src={part}
            alt="attachment"
            className="max-w-full max-h-60 rounded-md my-2 object-contain"
          />
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

function parseMarkdown(text: string, isMobile: boolean): React.ReactNode[] {
  if (!text) return [];
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
            {renderInlineLinks(line.slice(5), key, isMobile)}
          </h4>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={key} className="text-sm font-semibold mt-1">
            {renderInlineLinks(line.slice(4), key, isMobile)}
          </h3>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={key} className="text-base font-bold mt-1">
            {renderInlineLinks(line.slice(3), key, isMobile)}
          </h2>
        );
      } else if (line.startsWith('# ')) {
        elements.push(
          <h1 key={key} className="text-base font-bold mt-1">
            {renderInlineLinks(line.slice(2), key, isMobile)}
          </h1>
        );
      } else if (line === '') {
        elements.push(<br key={key} />);
      } else {
        elements.push(
          <span key={key} className="block">
            {renderInlineLinks(line, key, isMobile)}
          </span>
        );
      }
    });
  });

  return elements;
}
