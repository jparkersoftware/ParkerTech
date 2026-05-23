import { Fragment, type ReactNode } from 'react';

/**
 * Renders a string with any http(s) URLs turned into safe external links.
 * Plain text passes through unchanged. Keeps newlines so callers can pair
 * with `whitespace-pre-wrap`.
 */

const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g;

export default function AutoLinkText({ text }: { text: string | undefined }) {
  if (!text) return null;

  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      parts.push(<Fragment key={key++}>{text.slice(cursor, start)}</Fragment>);
    }
    const url = match[0];
    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
        style={{ color: 'var(--accent-bright)' }}
      >
        {url}
      </a>,
    );
    cursor = start + url.length;
  }
  if (cursor < text.length) {
    parts.push(<Fragment key={key++}>{text.slice(cursor)}</Fragment>);
  }
  return <>{parts}</>;
}
