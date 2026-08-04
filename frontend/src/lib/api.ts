import type {
  Achievement,
  AiStatus,
  AuthResponse,
  CourseResponse,
  DeckStats,
  Flashcard,
  GrammarPage,
  GrammarPageSummary,
  LeaderboardRow,
  LessonResponse,
  LessonSummary,
  NextLesson,
  ProgressSummary,
  TutorResponse,
  User,
  Word,
} from './types';

/**
 * Thin API client.
 *
 * In dev, Vite proxies /api to the backend so there is no CORS to configure.
 * In production VITE_API_URL points at the deployed API.
 */
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const ACCESS_KEY = 'kalba:access';
const REFRESH_KEY = 'kalba:refresh';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Callback fired when refreshing fails, so the app can bounce to sign-in. */
let onSignedOut: (() => void) | null = null;
export function setSignOutHandler(handler: () => void) {
  onSignedOut = handler;
}

// A single in-flight refresh shared by every concurrent 401, so a burst of
// requests after the token expires does not spawn a burst of refreshes.
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;

  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthResponse;
      tokens.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // Let the next expiry start a fresh attempt.
      setTimeout(() => (refreshing = null), 0);
    }
  })();

  return refreshing;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  /** Internal: prevents an infinite retry loop after refreshing. */
  retried?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, retried = false } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const access = tokens.access;
  if (auth && access) headers.authorization = `Bearer ${access}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline', 'Can’t reach the server — check your connection.');
  }

  if (res.status === 401 && auth && !retried) {
    const ok = await refreshSession();
    if (ok) return request<T>(path, { ...options, retried: true });
    tokens.clear();
    onSignedOut?.();
    throw new ApiError(401, 'unauthorized', 'Your session expired — please sign in again.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const payload = data as { error?: { code?: string; message?: string; details?: unknown } };
    throw new ApiError(
      res.status,
      payload?.error?.code ?? 'error',
      payload?.error?.message ?? `Request failed (${res.status})`,
      payload?.error?.details,
    );
  }

  return data as T;
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────
  register: (email: string, password: string, displayName?: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      auth: false,
      body: { email, password, displayName },
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    }),

  google: (credential: string) =>
    request<AuthResponse>('/api/auth/google', {
      method: 'POST',
      auth: false,
      body: { credential },
    }),

  me: () => request<{ user: User }>('/api/auth/me'),

  authConfig: () =>
    request<{ google: boolean; googleClientId: string | null }>('/api/auth/config', {
      auth: false,
    }),

  logout: () =>
    request<void>('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken: tokens.refresh ?? undefined },
    }),

  // ── Profile ─────────────────────────────────────────────────────────────
  updateProfile: (patch: Partial<User['settings']> & Record<string, unknown>) =>
    request<{ user: User }>('/api/users/me', { method: 'PATCH', body: patch }),

  changePassword: (newPassword: string, currentPassword?: string) =>
    request<void>('/api/users/me/password', {
      method: 'POST',
      body: { newPassword, currentPassword },
    }),

  deleteAccount: () => request<void>('/api/users/me', { method: 'DELETE' }),

  // ── Content ─────────────────────────────────────────────────────────────
  course: () => request<CourseResponse>('/api/content/course'),
  lesson: (slug: string) => request<LessonResponse>(`/api/content/lessons/${slug}`),
  words: (params: { level?: string; category?: string; q?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const suffix = query.toString();
    return request<{ words: Word[]; total: number }>(
      `/api/content/words${suffix ? `?${suffix}` : ''}`,
    );
  },
  categories: () =>
    request<{ categories: { level: string; category: string; count: number }[] }>(
      '/api/content/categories',
    ),
  grammarIndex: () => request<{ pages: GrammarPageSummary[] }>('/api/content/grammar'),
  grammarPage: (slug: string) => request<{ page: GrammarPage }>(`/api/content/grammar/${slug}`),

  // ── Progress ────────────────────────────────────────────────────────────
  submitLesson: (slug: string, answers: { index: number; response: string; timeMs?: number }[]) =>
    request<LessonSummary>(`/api/progress/lessons/${slug}/submit`, {
      method: 'POST',
      body: { answers },
    }),
  summary: () => request<ProgressSummary>('/api/progress/summary'),
  nextLesson: () => request<NextLesson>('/api/progress/next'),

  // ── Review deck ─────────────────────────────────────────────────────────
  dueCards: (limit = 20) => request<{ cards: Flashcard[] }>(`/api/flashcards/due?limit=${limit}`),
  deckStats: () => request<DeckStats>('/api/flashcards/stats'),
  reviewCard: (id: string, grade: 'again' | 'hard' | 'good' | 'easy') =>
    request<{ card: Flashcard; xpEarned: number }>(`/api/flashcards/${id}/review`, {
      method: 'POST',
      body: { grade },
    }),
  addCard: (lt: string) =>
    request<{ card: Flashcard }>('/api/flashcards', { method: 'POST', body: { lt } }),

  // ── Gamification ────────────────────────────────────────────────────────
  achievements: () => request<{ achievements: Achievement[] }>('/api/achievements'),
  leaderboard: () =>
    request<{ leaderboard: LeaderboardRow[]; you: LeaderboardRow | null }>('/api/leaderboard'),

  // ── Kalba AI ────────────────────────────────────────────────────────────
  aiStatus: () => request<AiStatus>('/api/ai/status'),
  tutor: (payload: {
    mode: string;
    message: string;
    context?: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }) => request<TutorResponse>('/api/ai/tutor', { method: 'POST', body: payload }),
};
