import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, ErrorNote, Field } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';

const HIGHLIGHTS = [
  {
    emoji: '🎖️',
    title: 'Six military levels',
    body: 'Recruit to Commander — 41 lessons, 257 words.',
  },
  {
    emoji: '📢',
    title: 'Real commands',
    body: 'Ramiai, Gulk, Kelkis — imperatives, not textbook infinitives.',
  },
  {
    emoji: '📡',
    title: 'Radio & reports',
    body: 'Prowords, SALUTE-style contact reports, casualty calls.',
  },
  {
    emoji: '🎙️',
    title: 'Speak and listen',
    body: 'Every word is spoken; speaking drills score your voice.',
  },
  {
    emoji: '🔁',
    title: 'Spaced repetition',
    body: 'SM-2 scheduling — hard words come back more often.',
  },
  { emoji: '🆓', title: 'Free forever', body: 'No paywall, no ads, no premium tier. Open source.' },
];

export function LandingPage() {
  const status = useAuth((state) => state.status);
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'authenticated') navigate('/', { replace: true });
  }, [navigate, status]);

  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-base-900 ring-2 ring-signal/50">
          <div className="flex h-11 w-14 flex-col overflow-hidden rounded ring-2 ring-signal">
            <div className="h-1/3 bg-lt-yellow" />
            <div className="h-1/3 bg-lt-green" />
            <div className="h-1/3 bg-lt-red" />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">Kalba</h1>
        <p className="mt-1 text-lg font-semibold text-signal">Military Lithuanian</p>
        <p className="muted mx-auto mt-3 max-w-sm text-sm">
          For soldiers, NATO personnel and anyone working with the Lithuanian Armed Forces. From
          your first <span className="font-semibold">Taip, pone kapitone</span> to giving a set of
          orders.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-3">
        <Button size="lg" fullWidth onClick={() => navigate('/register')}>
          Start training — free
        </Button>
        <Button size="lg" variant="secondary" fullWidth onClick={() => navigate('/login')}>
          I already have an account
        </Button>
      </div>

      <ul className="mb-8 grid gap-3">
        {HIGHLIGHTS.map((item) => (
          <Card as="li" key={item.title} className="flex items-start gap-3 p-4">
            <span className="text-2xl" aria-hidden>
              {item.emoji}
            </span>
            <div>
              <p className="font-bold">{item.title}</p>
              <p className="muted text-sm">{item.body}</p>
            </div>
          </Card>
        ))}
      </ul>

      <Card className="border-signal/30 bg-signal/5 p-4 text-center text-sm">
        <p className="font-bold text-signal">100% free, forever</p>
        <p className="muted mt-1">
          No premium tier, no ads, no tracking, no lives to wait for. Kalba is open source — fork
          it, host it, add your own language.
        </p>
      </Card>
    </div>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-12">
      <Link
        to="/welcome"
        className="muted mb-6 inline-block text-sm font-semibold hover:text-signal"
      >
        ← Kalba
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="muted mb-8 mt-1 text-sm">{subtitle}</p>
      {children}
      <div className="mt-6 text-center text-sm">{footer}</div>
    </div>
  );
}

/** The slice of Google Identity Services this component actually uses. */
interface GoogleIdentity {
  accounts?: {
    id?: {
      initialize(config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }): void;
      renderButton(
        target: HTMLElement,
        options: { theme: string; size: string; width: number; text: string },
      ): void;
    };
  };
}

function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const [available, setAvailable] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    api
      .authConfig()
      .then((config) => {
        setAvailable(config.google);
        setClientId(config.googleClientId);
      })
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    if (!available || !clientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const google = (window as unknown as { google?: GoogleIdentity }).google;
      if (!google?.accounts?.id) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => onCredential(response.credential),
      });
      const target = document.getElementById('google-signin');
      if (target) {
        google.accounts.id.renderButton(target, {
          theme: 'filled_black',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      }
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [available, clientId, onCredential]);

  if (!available) return null;

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-[color:var(--app-border)]" />
        <span className="muted text-xs font-semibold uppercase">or</span>
        <span className="h-px flex-1 bg-[color:var(--app-border)]" />
      </div>
      <div id="google-signin" className="flex justify-center" />
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((state) => state.login);
  const loginWithGoogle = useAuth((state) => state.loginWithGoogle);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Sveiki sugrįžę"
      subtitle="Sign in to pick up where you left off."
      footer={
        <p className="muted">
          No account?{' '}
          <Link to="/register" className="font-semibold text-signal underline">
            Create one
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <ErrorNote message={error} />}
        <Button type="submit" size="lg" fullWidth loading={busy}>
          Sign in
        </Button>
      </form>

      <GoogleButton
        onCredential={(credential) => {
          void loginWithGoogle(credential)
            .then(() => navigate('/', { replace: true }))
            .catch((err: unknown) =>
              setError(err instanceof ApiError ? err.message : 'Google sign-in failed.'),
            );
        }}
      />

      <Card className="mt-6 p-3 text-center text-xs">
        <p className="muted">
          Trying it out? Use <span className="font-mono font-semibold">demo@kalba.app</span> /{' '}
          <span className="font-mono font-semibold">Demo1234!</span>
        </p>
      </Card>
    </AuthShell>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuth((state) => state.register);
  const loginWithGoogle = useAuth((state) => state.loginWithGoogle);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(email, password, displayName || undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever. No card, no trial, no upsell."
      footer={
        <p className="muted">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-signal underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Name or call sign"
          autoComplete="nickname"
          placeholder="Vilkas"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <ErrorNote message={error} />}
        <Button type="submit" size="lg" fullWidth loading={busy}>
          Create account
        </Button>
      </form>

      <GoogleButton
        onCredential={(credential) => {
          void loginWithGoogle(credential)
            .then(() => navigate('/', { replace: true }))
            .catch((err: unknown) =>
              setError(err instanceof ApiError ? err.message : 'Google sign-in failed.'),
            );
        }}
      />
    </AuthShell>
  );
}
