import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './markdown';

describe('Markdown', () => {
  it('renders headings, paragraphs and inline emphasis', () => {
    render(
      <Markdown source={'## Kreipinys\n\nUse the **vocative** when you *address* someone.'} />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Kreipinys' })).toBeInTheDocument();
    expect(screen.getByText('vocative')).toBeInTheDocument();
    expect(screen.getByText('address')).toBeInTheDocument();
  });

  it('renders the grammar tables the briefings depend on', () => {
    const source = [
      '| Dictionary | Vocative |',
      '| --- | --- |',
      '| kapitonas | **kapitone** |',
      '| leitenantas | **leitenante** |',
    ].join('\n');

    render(<Markdown source={source} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Vocative' })).toBeInTheDocument();
    expect(screen.getByText('kapitone')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('renders both list styles', () => {
    render(<Markdown source={'- Stok!\n- Gulk!\n\n1. Ramiai!\n2. Laisvai!'} />);

    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('groups consecutive blockquote lines into one quote', () => {
    render(<Markdown source={'> Stok! Kas eina?\n> Halt! Who goes there?'} />);

    expect(screen.getByText('Stok! Kas eina?')).toBeInTheDocument();
    expect(screen.getByText('Halt! Who goes there?')).toBeInTheDocument();
  });

  it('renders inline code without executing it', () => {
    const { container } = render(<Markdown source={'Set `ANTHROPIC_API_KEY` in .env.'} />);

    expect(container.querySelector('code')?.textContent).toBe('ANTHROPIC_API_KEY');
  });

  it('escapes HTML rather than injecting it', () => {
    const { container } = render(<Markdown source={'<img src=x onerror="alert(1)">'} />);

    // Rendered as text, never as a live element.
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img');
  });
});
