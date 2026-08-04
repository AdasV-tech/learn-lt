import { create } from 'zustand';

export type Theme = 'system' | 'light' | 'dark';

interface SettingsState {
  theme: Theme;
  largeText: boolean;
  reducedMotion: boolean;
  ttsRate: number;
  autoPlayAudio: boolean;
  setTheme: (theme: Theme) => void;
  setLargeText: (on: boolean) => void;
  setReducedMotion: (on: boolean) => void;
  setTtsRate: (rate: number) => void;
  setAutoPlayAudio: (on: boolean) => void;
}

const KEYS = {
  theme: 'kalba:theme',
  largeText: 'kalba:largeText',
  reducedMotion: 'kalba:reducedMotion',
  ttsRate: 'kalba:ttsRate',
  autoPlay: 'kalba:autoPlay',
};

function read<T>(key: string, fallback: T, parse: (raw: string) => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
}

/** Push the current preferences onto <html> so CSS can react to them. */
function applyToDocument(state: Pick<SettingsState, 'theme' | 'largeText' | 'reducedMotion'>) {
  if (typeof document === 'undefined') return;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches !== false;

  const dark = state.theme === 'dark' || (state.theme === 'system' && prefersDark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('large-text', state.largeText);
  document.documentElement.classList.toggle('reduced-motion', state.reducedMotion);

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', dark ? '#0d1712' : '#f7f9f7');
}

const initial = {
  theme: read<Theme>(KEYS.theme, 'dark', (raw) => raw as Theme),
  largeText: read(KEYS.largeText, false, (raw) => raw === 'true'),
  reducedMotion: read(KEYS.reducedMotion, false, (raw) => raw === 'true'),
  ttsRate: read(KEYS.ttsRate, 0.9, (raw) => Number(raw) || 0.9),
  autoPlayAudio: read(KEYS.autoPlay, true, (raw) => raw === 'true'),
};

applyToDocument(initial);

export const useSettings = create<SettingsState>((set, get) => ({
  ...initial,

  setTheme(theme) {
    localStorage.setItem(KEYS.theme, theme);
    set({ theme });
    applyToDocument({ ...get(), theme });
  },
  setLargeText(largeText) {
    localStorage.setItem(KEYS.largeText, String(largeText));
    set({ largeText });
    applyToDocument({ ...get(), largeText });
  },
  setReducedMotion(reducedMotion) {
    localStorage.setItem(KEYS.reducedMotion, String(reducedMotion));
    set({ reducedMotion });
    applyToDocument({ ...get(), reducedMotion });
  },
  setTtsRate(ttsRate) {
    localStorage.setItem(KEYS.ttsRate, String(ttsRate));
    set({ ttsRate });
  },
  setAutoPlayAudio(autoPlayAudio) {
    localStorage.setItem(KEYS.autoPlay, String(autoPlayAudio));
    set({ autoPlayAudio });
  },
}));

// Follow the OS when the user has chosen "system".
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    const state = useSettings.getState();
    if (state.theme === 'system') applyToDocument(state);
  });
}
