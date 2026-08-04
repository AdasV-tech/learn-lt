import clsx from 'clsx';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { ProgressBar } from './ui';

const NAV = [
  { to: '/', label: 'Path', icon: '🧭', end: true },
  { to: '/review', label: 'Review', icon: '🔁', end: false },
  { to: '/tutor', label: 'Kalba AI', icon: '💬', end: false },
  { to: '/dictionary', label: 'Words', icon: '📖', end: false },
  { to: '/profile', label: 'Profile', icon: '🎖️', end: false },
];

export function BottomNav() {
  return (
    <nav aria-label="Main" className="safe-bottom surface fixed inset-x-0 bottom-0 z-30 border-t">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {NAV.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'tap flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[0.68rem] font-semibold transition-colors',
                  isActive ? 'text-signal' : 'muted hover:text-[color:var(--app-text)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="text-xl leading-none" aria-hidden>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  <span
                    className={clsx(
                      'h-0.5 w-6 rounded-full transition-colors',
                      isActive ? 'bg-signal' : 'bg-transparent',
                    )}
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function StatusBar() {
  const user = useAuth((state) => state.user);
  if (!user) return null;

  return (
    <header className="surface sticky top-0 z-20 border-b">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5">
        <NavLink to="/profile" className="tap flex items-center gap-2" aria-label="Your profile">
          <span
            className="grid h-9 w-9 place-items-center rounded-full bg-base-800 text-lg"
            aria-hidden
          >
            {user.avatarEmoji}
          </span>
        </NavLink>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-signal">
              Level {user.level.level}
            </span>
            <span className="muted text-[0.7rem] tabular-nums">
              {user.level.xpIntoLevel}/{user.level.xpForNextLevel} XP
            </span>
          </div>
          <ProgressBar
            className="mt-1 h-1.5"
            value={user.level.progress}
            label={`Level ${user.level.level} progress`}
          />
        </div>

        <div
          className="flex items-center gap-1 rounded-full bg-warn/10 px-2.5 py-1"
          title={`${user.streak}-day streak`}
        >
          <span aria-hidden>🔥</span>
          <span className="text-sm font-bold tabular-nums text-warn">{user.streak}</span>
          <span className="sr-only">day streak</span>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-signal focus:px-4 focus:py-2 focus:font-bold focus:text-base-950"
      >
        Skip to content
      </a>
      <StatusBar />
      <main id="main" className="mx-auto max-w-lg px-4 pb-28 pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

/** Full-bleed layout for the lesson player — no nav, no distractions. */
export function FocusShell({
  children,
  onExit,
  progress,
  hearts,
}: {
  children: ReactNode;
  onExit: () => void;
  progress: number;
  hearts?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="surface sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onExit}
            aria-label="Leave lesson"
            className="tap muted grid h-9 w-9 place-items-center rounded-full text-xl hover:text-alert"
          >
            ✕
          </button>
          <ProgressBar className="h-3 flex-1" value={progress} label="Lesson progress" />
          {hearts}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-44 pt-6">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  emoji,
  action,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          {emoji && <span aria-hidden>{emoji}</span>}
          {title}
        </h1>
        {subtitle && <p className="muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="tap muted mb-3 inline-flex items-center gap-1 text-sm font-semibold hover:text-signal"
    >
      <span aria-hidden>←</span> {children}
    </button>
  );
}
