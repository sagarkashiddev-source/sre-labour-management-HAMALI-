import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, CurrentUser } from '../api/client';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier: string, password: string) {
    const res = await authApi.login(identifier, password);
    // /login returns a slimmer shape than /me (no ownerPermission) — refetch
    // /me once so Owner permission flags are available immediately for
    // gating UI without a page reload.
    const full = await authApi.me().catch(() => ({ user: res.user }));
    setUser(full.user);
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
