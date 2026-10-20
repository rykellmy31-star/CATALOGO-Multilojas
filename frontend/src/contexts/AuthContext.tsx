import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'store_admin';
  storeId: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  isSuperAdmin: boolean;
  isStoreAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

function normalizeUser(u: any): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    storeId: u.store_id || u.storeId || null
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (!localStorage.getItem('token')) {
      localStorage.removeItem('user');
      return null;
    }
    const saved = localStorage.getItem('user');
    try { return saved ? normalizeUser(JSON.parse(saved)) : null; }
    catch { localStorage.removeItem('user'); return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const authRevision = useRef(0);
  const authCheck = useRef<AbortController | null>(null);

  useEffect(() => {
    const revision = ++authRevision.current;
    const controller = new AbortController();
    authCheck.current = controller;
    const savedToken = localStorage.getItem('token');

    if (!savedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      authCheck.current = null;
    } else {
      const checkAuth = async () => {
        try {
          const { data } = await api.get('/auth/me', { signal: controller.signal });
          if (controller.signal.aborted || authRevision.current !== revision || localStorage.getItem('token') !== savedToken) return;
          const mapped = normalizeUser(data.user);
          setUser(mapped);
          setToken(savedToken);
          localStorage.setItem('user', JSON.stringify(mapped));
        } catch {
          if (controller.signal.aborted || authRevision.current !== revision || localStorage.getItem('token') !== savedToken) return;
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setToken(null);
        } finally {
          if (!controller.signal.aborted && authRevision.current === revision) {
            if (authCheck.current === controller) authCheck.current = null;
            setLoading(false);
          }
        }
      };
      void checkAuth();
    }

    return () => {
      controller.abort();
      if (authCheck.current === controller) authCheck.current = null;
      authRevision.current++;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const revision = ++authRevision.current;
    authCheck.current?.abort();
    authCheck.current = null;
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (authRevision.current !== revision) throw new Error('Tentativa de login substituída por outra sessão.');
      const mapped = normalizeUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(mapped));
      setToken(data.token);
      setUser(mapped);
      setLoading(false);
      return mapped;
    } catch (error) {
      if (authRevision.current === revision) setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    ++authRevision.current;
    authCheck.current?.abort();
    authCheck.current = null;
    const savedToken = localStorage.getItem('token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    setLoading(false);
    if (savedToken) {
      api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${savedToken}` } }).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading, login, logout,
      isSuperAdmin: user?.role === 'super_admin',
      isStoreAdmin: user?.role === 'store_admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
