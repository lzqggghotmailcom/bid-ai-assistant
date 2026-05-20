'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@/lib/auth';
import api from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, companyName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ['/login', '/register'];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchProfile = useCallback(async (): Promise<User | null> => {
    try {
      const { data } = await api.get('/user/profile');
      return { id: data.id, email: data.email, company_name: data.company_name || '', plan: data.plan || 'free', projects_remaining: data.projects_remaining ?? 0, free_trial_used: data.free_trial_used ?? false };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const profile = await fetchProfile();
      if (profile) {
        setUserState(profile);
      }

      if (!profile && !PUBLIC_PATHS.includes(pathname)) {
        router.push('/login');
      }

      setLoading(false);
    })();
  }, [pathname, router, fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    await api.post('/auth/login', { email, password });
    const profile = await fetchProfile();
    if (profile) {
      setUserState(profile);
    }
  }, [fetchProfile]);

  const register = useCallback(
    async (email: string, password: string, companyName: string) => {
      await api.post('/auth/register', {
        email,
        password,
        company_name: companyName,
      });
      const profile = await fetchProfile();
      if (profile) {
        setUserState(profile);
      }
    },
    [fetchProfile]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore errors on logout
    }
    setUserState(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
