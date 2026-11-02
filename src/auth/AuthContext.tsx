import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { User, Usage } from "../types";
import { getMe, getUsage, login as apiLogin, signup as apiSignup, demoLogin as apiDemoLogin, logout as apiLogout } from "../api";
import { getStoredReviews } from "../checker/useLocalList";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  usage: Usage | null;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string) => Promise<User>;
  demoLogin: () => Promise<User>;
  logout: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getLocalReviewIds(): string[] {
  try {
    return getStoredReviews().map((item) => item.id).filter(Boolean);
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<Usage | null>(null);

  const refreshUsage = useCallback(async () => {
    try {
      const u = await getUsage();
      setUsage(u);
    } catch {
      // ignore
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const currentUser = await getMe();
      setUser(currentUser);
      await refreshUsage();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshUsage]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      const reviewIds = getLocalReviewIds();
      const u = await apiLogin(email, password, reviewIds);
      setUser(u);
      await refreshUsage();
      return u;
    },
    [refreshUsage]
  );

  const signup = useCallback(
    async (email: string, password: string): Promise<User> => {
      const reviewIds = getLocalReviewIds();
      const u = await apiSignup(email, password, reviewIds);
      setUser(u);
      await refreshUsage();
      return u;
    },
    [refreshUsage]
  );

  const demoLogin = useCallback(async (): Promise<User> => {
    const reviewIds = getLocalReviewIds();
    const u = await apiDemoLogin(reviewIds);
    setUser(u);
    await refreshUsage();
    return u;
  }, [refreshUsage]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      await refreshUsage();
    }
  }, [refreshUsage]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        usage,
        login,
        signup,
        demoLogin,
        logout,
        refreshUsage,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
