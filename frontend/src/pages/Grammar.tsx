import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell, BackLink, PageHeader } from '../components/layout';
import { Markdown } from '../components/markdown';
import { Badge, Card, ErrorNote, Skeleton } from '../components/ui';
import { api, ApiError } from '../lib/api';
import type { GrammarPage, GrammarPageSummary } from '../lib/types';

export function GrammarIndexPage() {
  const [pages, setPages] = useState<GrammarPageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .grammarIndex()
      .then((response) => setPages(response.pages))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load the grammar reference.'),
      );
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="Grammar"
        emoji="📘"
        subtitle="The rules behind the drills — browse them any time."
      />

      {error && <ErrorNote message={error} />}

      {!pages && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {pages?.map((page) => (
          <Card as="li" key={page.slug}>
            <Link to={`/grammar/${page.slug}`} className="tap flex items-start gap-3 p-4">
              <span className="text-2xl" aria-hidden>
                📖
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-bold">{page.title}</h2>
                  <Badge className="shrink-0">{page.level.replace('MIL', 'L')}</Badge>
                </div>
                <p className="muted mt-0.5 text-sm">{page.summary}</p>
              </div>
              <span className="muted shrink-0 text-lg" aria-hidden>
                ›
              </span>
            </Link>
          </Card>
        ))}
      </ul>
    </AppShell>
  );
}

export function GrammarDetailPage() {
  const { slug = '' } = useParams();
  const [page, setPage] = useState<GrammarPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(null);
    api
      .grammarPage(slug)
      .then((response) => setPage(response.page))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load that page.'),
      );
  }, [slug]);

  return (
    <AppShell>
      <BackLink to="/grammar">Grammar</BackLink>

      {error && <ErrorNote message={error} />}
      {!page && !error && <Skeleton className="h-96" />}

      {page && (
        <>
          <PageHeader title={page.title} subtitle={page.summary} />
          <Card className="p-5">
            <Markdown source={page.body} />
          </Card>
        </>
      )}
    </AppShell>
  );
}
