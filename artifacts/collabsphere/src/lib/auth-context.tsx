import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import {
  login as apiLogin,
  signup as apiSignup,
  logout as apiLogout,
  refresh as apiRefresh,
  getMe as apiGetMe,
  type User,
} from '@workspace/api-client-react';

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
    return () => setAuthTokenGetter(null);
  }, []);

  const silentRefresh = useCallback(async () => {
    try {
      const { accessToken: token } = await apiRefresh();
      setAccessToken(token);
      tokenRef.current = token;
      const me = await apiGetMe();
      setUser(me);
      return true;
    } catch {
      setAccessToken(null);
      tokenRef.current = null;
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    silentRefresh().finally(() => setLoading(false));
    const interval = setInterval(silentRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    console.log('[DEBUG] VITE_API_URL =', import.meta.env.VITE_API_URL);
    console.log('[DEBUG] calling apiLogin...');
    try {
      const result = await apiLogin({ email, password });
      console.log('[DEBUG] apiLogin resolved:', result);
      setAccessToken(result.accessToken);
      tokenRef.current = result.accessToken;
      setUser(result.user);
      return result.user;
    } catch (err) {
      console.log('[DEBUG] apiLogin threw:', err);
      throw err;
    }
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      console.log('[DEBUG] VITE_API_URL =', import.meta.env.VITE_API_URL);
      console.log('[DEBUG] calling apiSignup...');
      try {
        const result = await apiSignup({ name, email, password });
        console.log('[DEBUG] apiSignup resolved:', result);
        setAccessToken(result.accessToken);
        tokenRef.current = result.accessToken;
        setUser(result.user);
        return result.user;
      } catch (err) {
        console.log('[DEBUG] apiSignup threw:', err);
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setAccessToken(null);
      tokenRef.current = null;
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, loading, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}