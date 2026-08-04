import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { AppShell, PageHeader } from '../components/layout';
import { AudioButton } from '../components/audio';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Skeleton } from '../components/ui';
import { api, ApiError } from '../lib/api';
import type { Level, Word } from '../lib/types';

const LEVELS: { value: Level | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'MIL1', label: 'I' },
  { value: 'MIL2', label: 'II' },
  { value: 'MIL3', label: 'III' },
  { value: 'MIL4', label: 'IV' },
  { value: 'MIL5', label: 'V' },
  { value: 'MIL6', label: 'VI' },
];

export function DictionaryPage() {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<Level | ''>('');
  const [category, setCategory] = useState('');
  const [words, setWords] = useState<Word[] | null>(null);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    api
      .categories()
      .then((response) => {
        const totals = new Map<string, number>();
        for (const row of response.categories) {
          totals.set(row.category, (totals.get(row.category) ?? 0) + row.count);
        }
        setCategories(
          [...totals.entries()]
            .map(([name, count]) => ({ category: name, count }))
            .sort((a, b) => b.count - a.count),
        );
      })
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const timer = setTimeout(() => {
      api
        .words({
          q: query || undefined,
          level: level || undefined,
          category: category || undefined,
          limit: 300,
        })
        .then((response) => {
          if (!cancelled) setWords(response.words);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.message : 'Could not search the dictionary.');
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, level, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, Word[]>();
    for (const word of words ?? []) {
      const list = map.get(word.category);
      if (list) list.push(word);
      else map.set(word.category, [word]);
    }
    return [...map.entries()];
  }, [words]);

  const addToDeck = async (word: Word) => {
    try {
      await api.addCard(word.lt);
      setAdded((current) => new Set(current).add(word.lt));
    } catch {
      // Non-critical — the button just stays unchanged.
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Dictionary"
        emoji="📖"
        subtitle="Every word in the course, with pronunciation, grammar and field usage."
      />

      <Field
        label="Search"
        placeholder="Lithuanian or English…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mb-3"
      />

      <div className="no-scrollbar -mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4">
        {LEVELS.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            onClick={() => setLevel(option.value)}
            className={clsx(
              'tap shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors',
              level === option.value
                ? 'border-signal bg-signal/15 text-signal'
                : 'raised border-[color:var(--app-border)]',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4">
        <button
          type="button"
          onClick={() => setCategory('')}
          className={clsx(
            'tap shrink-0 rounded-full border px-3 py-1 text-xs font-semibold',
            category === ''
              ? 'border-signal text-signal'
              : 'raised border-[color:var(--app-border)]',
          )}
        >
          all topics
        </button>
        {categories.map((item) => (
          <button
            key={item.category}
            type="button"
            onClick={() => setCategory(category === item.category ? '' : item.category)}
            className={clsx(
              'tap shrink-0 rounded-full border px-3 py-1 text-xs font-semibold',
              category === item.category
                ? 'border-signal text-signal'
                : 'raised border-[color:var(--app-border)]',
            )}
          >
            {item.category}
          </button>
        ))}
      </div>

      {error && <ErrorNote message={error} />}

      {!words && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      )}

      {words && words.length === 0 && (
        <EmptyState
          emoji="🔍"
          title="No matches"
          description="Try a different word or clear the filters."
        />
      )}

      <div className="space-y-5">
        {grouped.map(([groupName, groupWords]) => (
          <section key={groupName}>
            <h2 className="muted mb-2 text-xs font-bold uppercase tracking-wide">
              {groupName} · {groupWords.length}
            </h2>
            <ul className="space-y-2">
              {groupWords.map((word) => {
                const open = expanded === word.lt;
                return (
                  <Card as="li" key={word.id} className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : word.lt)}
                      aria-expanded={open}
                      className="tap flex w-full items-center gap-3 p-3 text-left"
                    >
                      <span className="text-2xl" aria-hidden>
                        {word.emoji ?? '🪖'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{word.lt}</p>
                        <p className="muted truncate text-sm">{word.en}</p>
                      </div>
                      <Badge className="shrink-0">{word.level.replace('MIL', 'L')}</Badge>
                    </button>

                    {open && (
                      <div
                        className="animate-slide-up border-t px-3 pb-3 pt-3"
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <AudioButton text={word.lt} size="sm" />
                          <p className="muted font-mono text-sm">{word.pron}</p>
                          <Badge className="ml-auto">{word.pos}</Badge>
                        </div>

                        {word.grammar && (
                          <div className="mb-2 rounded-lg border p-2.5 text-sm raised">
                            <p className="muted mb-1 text-[0.65rem] font-bold uppercase tracking-wide">
                              Grammar
                            </p>
                            <p>{word.grammar}</p>
                          </div>
                        )}

                        {word.usage && (
                          <div className="mb-2 rounded-lg border border-info/30 bg-info/10 p-2.5 text-sm">
                            <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-info">
                              In the field
                            </p>
                            <p>{word.usage}</p>
                          </div>
                        )}

                        {word.examples.map((example) => (
                          <div key={example.lt} className="mb-2 flex items-start gap-2">
                            <AudioButton text={example.lt} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{example.lt}</p>
                              <p className="muted text-xs">{example.en}</p>
                            </div>
                          </div>
                        ))}

                        <Button
                          size="sm"
                          variant={added.has(word.lt) ? 'secondary' : 'outline'}
                          className="mt-2"
                          disabled={added.has(word.lt)}
                          onClick={() => void addToDeck(word)}
                        >
                          {added.has(word.lt) ? '✓ In your deck' : '+ Add to review deck'}
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
