import clsx from 'clsx';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, BackLink, PageHeader } from '../components/layout';
import { Button, Card, ErrorNote, Field, Toggle } from '../components/ui';
import { hasLithuanianVoice, speak, ttsSupported } from '../lib/speech';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import type { Theme } from '../store/settings';

const AVATARS = ['🪖', '🎖️', '🧭', '📡', '⭐', '🛡️', '🦺', '🥾', '🎯', '⚙️'];
const GOALS = [
  { xp: 20, label: 'Light', hint: '~5 min' },
  { xp: 50, label: 'Standard', hint: '~10 min' },
  { xp: 100, label: 'Serious', hint: '~20 min' },
  { xp: 200, label: 'Intense', hint: '~40 min' },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const logout = useAuth((state) => state.logout);

  const settings = useSettings();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const save = async (patch: Record<string, unknown>, message = 'Saved') => {
    setError(null);
    try {
      const response = await api.updateProfile(patch);
      setUser(response.user);
      setStatus(message);
      setTimeout(() => setStatus(null), 2200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that.');
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(newPassword, currentPassword || undefined);
      setNewPassword('');
      setCurrentPassword('');
      setStatus('Password changed — other devices were signed out.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (
      !window.confirm(
        'Delete your account permanently? All progress, streaks and review cards are erased. This cannot be undone.',
      )
    ) {
      return;
    }
    try {
      await api.deleteAccount();
      await logout();
      navigate('/welcome', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the account.');
    }
  };

  return (
    <AppShell>
      <BackLink to="/profile">Profile</BackLink>
      <PageHeader title="Settings" emoji="⚙️" />

      {status && (
        <div className="mb-4 rounded-xl border border-signal/40 bg-signal/10 p-3 text-sm text-signal">
          {status}
        </div>
      )}
      {error && <ErrorNote message={error} />}

      {/* Profile */}
      <Section title="Profile">
        <Field
          label="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          onBlur={() => displayName !== user.displayName && void save({ displayName })}
        />

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">Avatar</p>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => void save({ avatarEmoji: emoji })}
                aria-label={`Use ${emoji} as your avatar`}
                aria-pressed={user.avatarEmoji === emoji}
                className={clsx(
                  'tap grid h-11 w-11 place-items-center rounded-xl border-2 text-xl transition-colors',
                  user.avatarEmoji === emoji
                    ? 'border-signal bg-signal/15'
                    : 'raised border-[color:var(--app-border)]',
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Daily goal */}
      <Section title="Daily goal">
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((goal) => (
            <button
              key={goal.xp}
              type="button"
              onClick={() => void save({ dailyGoalXp: goal.xp })}
              className={clsx(
                'tap rounded-xl border-2 p-3 text-left transition-colors',
                user.dailyGoalXp === goal.xp
                  ? 'border-signal bg-signal/10'
                  : 'raised border-[color:var(--app-border)]',
              )}
            >
              <p className="font-bold">{goal.label}</p>
              <p className="muted text-xs">
                {goal.xp} XP · {goal.hint}
              </p>
            </button>
          ))}
        </div>
      </Section>

      {/* Accessibility */}
      <Section title="Accessibility & display">
        <div className="mb-3">
          <p className="mb-2 text-sm font-semibold">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {(['dark', 'light', 'system'] as Theme[]).map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => {
                  settings.setTheme(theme);
                  void save({ theme }, 'Theme saved');
                }}
                className={clsx(
                  'tap rounded-xl border-2 py-2.5 text-sm font-bold capitalize transition-colors',
                  settings.theme === theme
                    ? 'border-signal bg-signal/10 text-signal'
                    : 'raised border-[color:var(--app-border)]',
                )}
              >
                {theme}
              </button>
            ))}
          </div>
          <p className="muted mt-2 text-xs">
            Military mode is the dark theme — it is the default and easiest on the eyes at night.
          </p>
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
          <Toggle
            checked={settings.largeText}
            onChange={(value) => {
              settings.setLargeText(value);
              void save({ largeText: value }, 'Saved');
            }}
            label="Large text"
            description="Scales the whole interface up by ~18%."
          />
          <Toggle
            checked={settings.reducedMotion}
            onChange={(value) => {
              settings.setReducedMotion(value);
              void save({ reducedMotion: value }, 'Saved');
            }}
            label="Reduce motion"
            description="Removes animations and transitions."
          />
          <Toggle
            checked={settings.autoPlayAudio}
            onChange={settings.setAutoPlayAudio}
            label="Auto-play audio"
            description="Speak listening exercises as soon as they appear."
          />
        </div>
      </Section>

      {/* Audio */}
      <Section title="Pronunciation audio">
        <label htmlFor="tts-rate" className="mb-1 block text-sm font-semibold">
          Speech speed — {settings.ttsRate.toFixed(2)}×
        </label>
        <input
          id="tts-rate"
          type="range"
          min={0.5}
          max={1.3}
          step={0.05}
          value={settings.ttsRate}
          onChange={(event) => {
            const rate = Number(event.target.value);
            settings.setTtsRate(rate);
            void save({ ttsRate: rate }, 'Saved');
          }}
          className="w-full accent-[color:theme(colors.signal.DEFAULT)]"
        />
        <Button
          className="mt-3"
          variant="secondary"
          size="sm"
          onClick={() => speak('Dėmesio! Skyrius, pirmyn!', { rate: settings.ttsRate })}
        >
          🔈 Test the voice
        </Button>
        <p className="muted mt-2 text-xs">
          {!ttsSupported()
            ? 'This browser has no speech synthesis.'
            : hasLithuanianVoice()
              ? 'A Lithuanian voice is installed on this device.'
              : 'No Lithuanian voice found — audio will use your default voice and mispronounce words. Add one in your system speech settings.'}
        </p>
      </Section>

      {/* Security */}
      <Section title="Password">
        <form onSubmit={changePassword} className="flex flex-col gap-3">
          {user.hasPassword && (
            <Field
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          )}
          <Field
            label={user.hasPassword ? 'New password' : 'Set a password'}
            type="password"
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters."
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <Button
            type="submit"
            variant="secondary"
            loading={busy}
            disabled={newPassword.length < 8}
          >
            {user.hasPassword ? 'Change password' : 'Set password'}
          </Button>
        </form>
      </Section>

      {/* Data */}
      <Section title="Your data">
        <p className="muted mb-3 text-sm">
          Kalba stores only what it needs to track your progress. No analytics, no ad networks, no
          third-party trackers.
        </p>
        <a
          href="/api/users/me/export"
          className="tap raised mb-2 flex items-center justify-between rounded-xl border p-3 text-sm font-semibold"
        >
          Download my data (JSON)
          <span aria-hidden>↓</span>
        </a>
        <Button variant="danger" fullWidth onClick={() => void deleteAccount()}>
          Delete my account
        </Button>
      </Section>

      <Card className="mt-6 p-4 text-center text-xs">
        <p className="font-bold text-signal">Kalba is free forever</p>
        <p className="muted mt-1">
          Open source, no ads, no premium tier, no data sales. If it ever asks you for money, it
          isn’t Kalba.
        </p>
      </Card>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="muted mb-2 text-xs font-bold uppercase tracking-wide">{title}</h2>
      <Card className="p-4">{children}</Card>
    </section>
  );
}
