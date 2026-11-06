// 本文用のごく小さな Markdown:空行で段落、**太字**、`code` だけを扱う
import { Fragment, type ReactNode } from 'react';

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

export const renderInline = (text: string): ReactNode[] =>
  text.split(INLINE).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });

export const paragraphs = (text: string): string[] => text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {paragraphs(text).map((p, i) => (
        <p key={i}>{renderInline(p)}</p>
      ))}
    </>
  );
}

/** 先頭の段落だけをインラインで(リード文など) */
export function InlineMarkdown({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

/** Markdown記号を取り除いたプレーンテキスト(meta description 用) */
export const plain = (text: string): string => text.replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
