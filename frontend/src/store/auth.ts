import { create } from 'zustand';
import { api, setSignOutHandler, tokens } from '../lib/api';
import type { User } from '../lib/types';

interface AuthState {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  /** Merge fresh XP/streak numbers in after finishing a lesson. */
  applyProgress: (patch: Partial<Pick<User, 'xp' | 'level' | 'streak' | 'longestStreak'>>) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',
  error: null,

  async bootstrap() {
    if (!tokens.access) {
      set({ status: 'anonymous', user: null });
      return;
    }
    try {
      const { user } = await api.me();
      set({ user, status: 'authenticated', error: null });
    } catch {
      tokens.clear();
      set({ user: null, status: 'anonymous' });
    }
  },

  async login(email, password) {
    set({ error: null });
    const data = await api.login(email, password);
    tokens.set(data.accessToken, data.refreshToken);
    set({ user: data.user, status: 'authenticated' });
  },

  async register(email, password, displayName) {
    set({ error: null });
    const data = await api.register(email, password, displayName);
    tokens.set(data.accessToken, data.refreshToken);
    set({ user: data.user, status: 'authenticated' });
  },

  async loginWithGoogle(credential) {
    set({ error: null });
    const data = await api.google(credential);
    tokens.set(data.accessToken, data.refreshToken);
    set({ user: data.user, status: 'authenticated' });
  },

  async logout() {
    try {
      await api.logout();
    } catch {
      // Signing out locally matters more than the server round trip.
    }
    tokens.clear();
    set({ user: null, status: 'anonymous' });
  },

  setUser(user) {
    set({ user });
  },

  applyProgress(patch) {
    const user = get().user;
    if (!user) return;
    set({ user: { ...user, ...patch } });
  },
}));

// When a refresh fails mid-session, drop straight back to the signed-out state.
setSignOutHandler(() => {
  useAuth.setState({ user: null, status: 'anonymous' });
});
