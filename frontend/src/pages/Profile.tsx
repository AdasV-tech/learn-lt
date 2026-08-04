import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../components/layout';
import { Badge, Button, Card, ErrorNote, ProgressBar, Skeleton } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import type { Achievement, LeaderboardRow, ProgressSummary } from '../lib/types';

const SKILL_LABELS: Record<string, string> = {
  select: 'Recognition',
  listen_select: 'Listening',
  listen_type: 'Dictation',
  speak: 'Speaking',
  write: 'Writing',
  word_bank: 'Sentence building',
  match: 'Matching',
  fill_blank: 'Gap fill',
  react: 'Command reaction',
};

export function ProfilePage() {
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const navigate = useNavigate();

  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .summary()
      .then(setSummary)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load your statistics.'),
      );
  }, []);

  if (!user) return null;

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-4">
        <span
          className="grid h-16 w-16 place-items-center rounded-2xl bg-base-800 text-3xl"
          aria-hidden
        >
          {user.avatarEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{user.displayName}</h1>
          <p className="muted truncate text-sm">{user.email}</p>
          {summary && (
            <Badge tone="success" className="mt-1">
              {summary.militaryLevel.emoji} {summary.militaryLevel.nameLt} ·{' '}
              {summary.militaryLevel.nameEn}
            </Badge>
          )}
        </div>
        <Link to="/settings" aria-label="Settings" className="tap muted text-2xl hover:text-signal">
          ⚙️
        </Link>
      </div>

      {error && <ErrorNote message={error} />}

      <Card className="mb-4 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-bold">Level {user.level.level}</span>
          <span className="muted text-xs tabular-nums">
            {user.level.xpIntoLevel} / {user.level.xpForNextLevel} XP to level{' '}
            {user.level.level + 1}
          </span>
        </div>
        <ProgressBar value={user.level.progress} label="Level progress" />
        <p className="muted mt-2 text-xs">{user.xp} XP earned in total</p>
      </Card>

      {!summary && <Skeleton className="h-40" />}

      {summary && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <StatCard
              emoji="🔥"
              label="Current streak"
              value={`${summary.streak.current}d`}
              tone="warn"
            />
            <StatCard emoji="🏅" label="Longest streak" value={`${summary.streak.longest}d`} />
            <StatCard
              emoji="📚"
              label="Lessons"
              value={`${summary.lessons.completed}/${summary.lessons.total}`}
            />
            <StatCard
              emoji="🎯"
              label="Accuracy"
              value={`${summary.accuracy.percent}%`}
              tone="signal"
            />
            <StatCard emoji="🧠" label="Words met" value={String(summary.words.learned)} />
            <StatCard emoji="🏆" label="Perfect runs" value={String(summary.lessons.perfect)} />
          </div>

          <Card className="mb-4 p-4">
            <p className="mb-1 text-sm font-bold">Daily goal</p>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="muted text-xs">
                {summary.dailyGoal.earnedToday} / {summary.dailyGoal.goalXp} XP today
              </span>
              {summary.dailyGoal.met && <Badge tone="success">Met ✓</Badge>}
            </div>
            <ProgressBar
              value={summary.dailyGoal.earnedToday}
              max={summary.dailyGoal.goalXp}
              tone={summary.dailyGoal.met ? 'signal' : 'warn'}
              label="Daily goal"
            />
          </Card>

          {summary.skills.length > 0 && (
            <Card className="mb-4 p-4">
              <p className="mb-3 text-sm font-bold">Skill breakdown</p>
              <ul className="space-y-2.5">
                {summary.skills
                  .filter((skill) => skill.total > 0)
                  .sort((a, b) => b.total - a.total)
                  .map((skill) => (
                    <li key={skill.type}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-semibold">
                          {SKILL_LABELS[skill.type] ?? skill.type}
                        </span>
                        <span className="muted tabular-nums">
                          {skill.accuracy}% · {skill.total}
                        </span>
                      </div>
                      <ProgressBar
                        className="h-1.5"
                        value={skill.accuracy}
                        max={100}
                        tone={
                          skill.accuracy >= 80 ? 'signal' : skill.accuracy >= 60 ? 'info' : 'warn'
                        }
                        label={SKILL_LABELS[skill.type] ?? skill.type}
                      />
                    </li>
                  ))}
              </ul>
            </Card>
          )}

          <ActivityCalendar days={summary.calendar} />
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/achievements">
          <Button variant="secondary" fullWidth>
            🏅 Achievements
          </Button>
        </Link>
        <Link to="/leaderboard">
          <Button variant="secondary" fullWidth>
            📊 Leaderboard
          </Button>
        </Link>
      </div>

      <Button
        className="mt-3"
        variant="ghost"
        fullWidth
        onClick={() => void logout().then(() => navigate('/welcome'))}
      >
        Sign out
      </Button>
    </AppShell>
  );
}

function StatCard({
  emoji,
  label,
  value,
  tone,
}: {
  emoji: string;
  label: string;
  value: string;
  tone?: 'warn' | 'signal';
}) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <div className="min-w-0">
        <p
          className={clsx(
            'text-xl font-extrabold tabular-nums',
            tone === 'warn' && 'text-warn',
            tone === 'signal' && 'text-signal',
          )}
        >
          {value}
        </p>
        <p className="muted truncate text-[0.65rem] font-bold uppercase tracking-wide">{label}</p>
      </div>
    </Card>
  );
}

/** Last 20 weeks of activity, GitHub-style. */
function ActivityCalendar({ days }: { days: ProgressSummary['calendar'] }) {
  const byDay = new Map(days.map((day) => [day.day, day.xp]));
  const cells: { date: string; xp: number }[] = [];
  const today = new Date();

  for (let offset = 20 * 7 - 1; offset >= 0; offset--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    cells.push({ date: key, xp: byDay.get(key) ?? 0 });
  }

  const intensity = (xp: number) => {
    if (xp === 0) return 'bg-base-800';
    if (xp < 25) return 'bg-signal/25';
    if (xp < 60) return 'bg-signal/50';
    if (xp < 120) return 'bg-signal/75';
    return 'bg-signal';
  };

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-bold">Training days</p>
      <div className="no-scrollbar overflow-x-auto">
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
          {cells.map((cell) => (
            <div
              key={cell.date}
              title={`${cell.date}: ${cell.xp} XP`}
              className={clsx('h-3 w-3 rounded-[3px]', intensity(cell.xp))}
            />
          ))}
        </div>
      </div>
      <div className="muted mt-3 flex items-center gap-1.5 text-[0.65rem]">
        <span>Less</span>
        {['bg-base-800', 'bg-signal/25', 'bg-signal/50', 'bg-signal/75', 'bg-signal'].map(
          (tone) => (
            <span key={tone} className={clsx('h-3 w-3 rounded-[3px]', tone)} />
          ),
        )}
        <span>More</span>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, string> = {
  bronze: 'border-orange-700/50 bg-orange-900/20',
  silver: 'border-slate-400/50 bg-slate-400/10',
  gold: 'border-warn/50 bg-warn/10',
  platinum: 'border-info/50 bg-info/10',
};

export function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .achievements()
      .then((response) => setAchievements(response.achievements))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load achievements.'),
      );
  }, []);

  const unlocked = achievements?.filter((item) => item.unlocked).length ?? 0;

  return (
    <AppShell>
      <PageHeader
        title="Achievements"
        emoji="🏅"
        subtitle={
          achievements
            ? `${unlocked} of ${achievements.length} unlocked`
            : 'Every one is free to earn.'
        }
      />

      {error && <ErrorNote message={error} />}
      {!achievements && <Skeleton className="h-96" />}

      <ul className="space-y-2">
        {achievements?.map((achievement) => (
          <Card
            as="li"
            key={achievement.slug}
            className={clsx(
              'flex items-center gap-3 p-3',
              achievement.unlocked ? TIER_STYLES[achievement.tier] : 'opacity-70',
            )}
          >
            <span className={clsx('text-3xl', !achievement.unlocked && 'grayscale')} aria-hidden>
              {achievement.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{achievement.title}</p>
              <p className="muted text-xs">{achievement.description}</p>
              {!achievement.unlocked && (
                <>
                  <ProgressBar
                    className="mt-1.5 h-1"
                    value={achievement.progress}
                    label={achievement.title}
                  />
                  <p className="muted mt-1 text-[0.65rem] tabular-nums">
                    {achievement.value ?? 0} / {achievement.threshold}
                  </p>
                </>
              )}
            </div>
            <Badge tone={achievement.unlocked ? 'success' : 'neutral'} className="shrink-0">
              +{achievement.xpReward}
            </Badge>
          </Card>
        ))}
      </ul>
    </AppShell>
  );
}

export function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [you, setYou] = useState<LeaderboardRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .leaderboard()
      .then((response) => {
        setRows(response.leaderboard);
        setYou(response.you);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load the leaderboard.'),
      );
  }, []);

  const showYouSeparately = you && !rows?.some((row) => row.isYou);

  return (
    <AppShell>
      <PageHeader
        title="Leaderboard"
        emoji="📊"
        subtitle="Only your display name, avatar, XP and streak are ever shown."
      />

      {error && <ErrorNote message={error} />}
      {!rows && <Skeleton className="h-80" />}

      <ul className="space-y-1.5">
        {rows?.map((row) => (
          <LeaderRow key={row.id} row={row} />
        ))}
      </ul>

      {showYouSeparately && (
        <>
          <p className="muted my-3 text-center text-xs">…</p>
          <LeaderRow row={you} />
        </>
      )}
    </AppShell>
  );
}

function LeaderRow({ row }: { row: LeaderboardRow }) {
  const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null;

  return (
    <Card
      as="li"
      className={clsx(
        'flex items-center gap-3 p-2.5',
        row.isYou && 'border-signal/60 bg-signal/10',
      )}
    >
      <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums">
        {medal ?? row.rank}
      </span>
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-800 text-lg"
        aria-hidden
      >
        {row.avatarEmoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {row.displayName}
          {row.isYou && <span className="ml-1.5 text-xs text-signal">you</span>}
        </p>
        <p className="muted text-xs">
          Level {row.level} · 🔥 {row.streak}
        </p>
      </div>
      <span className="shrink-0 text-sm font-extrabold tabular-nums text-signal">{row.xp} XP</span>
    </Card>
  );
}
