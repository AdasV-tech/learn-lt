import type { ReactNode } from 'react';

/**
 * A small Markdown renderer for the grammar briefings.
 *
 * The curriculum is authored in this repo, so the input is trusted and the
 * subset is fixed: headings, paragraphs, lists, tables, blockquotes, and
 * inline bold / italic / code. Everything is rendered as React elements — no
 * `dangerouslySetInnerHTML`, so there is no XSS surface even if content is
 * later contributed by others.
 */

let keySeed = 0;
const nextKey = () => `md-${keySeed++}`;

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: code first so ** inside backticks is left alone.
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith('`')) {
      nodes.push(<code key={nextKey()}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={nextKey()}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={nextKey()}>{token.slice(1, -1)}</em>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function splitRow(row: string): string[] {
  return row
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.split('\n');
  const blocks: ReactNode[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';

    // Blank
    if (!line.trim()) {
      index += 1;
      continue;
    }

    // Table: a header row followed by a separator row.
    if (line.trim().startsWith('|') && (lines[index + 1] ?? '').includes('---')) {
      const header = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('|')) {
        rows.push(splitRow(lines[index] ?? ''));
        index += 1;
      }
      blocks.push(
        <div key={nextKey()} className="table-wrap">
          <table>
            <thead>
              <tr>
                {header.map((cell) => (
                  <th key={nextKey()}>{inline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={nextKey()}>
                  {row.map((cell) => (
                    <td key={nextKey()}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Headings
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 2;
      const text = heading[2] ?? '';
      const Tag = (level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
      blocks.push(<Tag key={nextKey()}>{inline(text)}</Tag>);
      index += 1;
      continue;
    }

    // Blockquote (consecutive "> " lines collapse into one)
    if (line.trim().startsWith('>')) {
      const quoted: string[] = [];
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('>')) {
        quoted.push((lines[index] ?? '').replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote key={nextKey()}>
          {quoted.map((text) => (
            <p key={nextKey()} className="mb-0">
              {inline(text)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test((lines[index] ?? '').trim())) {
        items.push((lines[index] ?? '').trim().replace(/^\d+\.\s/, ''));
        index += 1;
      }
      blocks.push(
        <ol key={nextKey()}>
          {items.map((item) => (
            <li key={nextKey()}>{inline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(line.trim())) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s/.test((lines[index] ?? '').trim())) {
        items.push((lines[index] ?? '').trim().replace(/^[-*]\s/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={nextKey()}>
          {items.map((item) => (
            <li key={nextKey()}>{inline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !/^[|>#]/.test((lines[index] ?? '').trim())
    ) {
      paragraph.push(lines[index] ?? '');
      index += 1;
    }
    blocks.push(<p key={nextKey()}>{inline(paragraph.join(' '))}</p>);
  }

  return <div className={`prose-kalba ${className ?? ''}`}>{blocks}</div>;
}
