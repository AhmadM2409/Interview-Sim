import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'ai_interview_demo_token';
const DEMO_TOKEN = 'mock-auth-token';

const AuthContext = createContext(null);

const readToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEY);
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(readToken);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      loginWithDemo: () => setToken(DEMO_TOKEN),
      logout: () => setToken(null),
    }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return value;
};
