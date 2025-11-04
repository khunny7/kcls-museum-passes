import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface AuthSession {
  sessionId: string;
  libraryCard: string;
  expiresAt: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  session: AuthSession | null;
  login: (libraryCard: string, pin: string, bookingUrl?: string) => Promise<{ success: boolean; error?: string; sessionId?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'kcls_auth_session';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
        if (storedSession) {
          const parsed = JSON.parse(storedSession) as AuthSession;
          
          // Check if session expired
          if (Date.now() < parsed.expiresAt) {
            setSession(parsed);
          } else {
            // Clean up expired session
            localStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Failed to load session:', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  // Auto-logout when session expires
  useEffect(() => {
    if (!session) return;

    const timeUntilExpiry = session.expiresAt - Date.now();
    if (timeUntilExpiry <= 0) {
      logout();
      return;
    }

    const timer = setTimeout(() => {
      logout();
      alert('Your session has expired. Please log in again.');
    }, timeUntilExpiry);

    return () => clearTimeout(timer);
  }, [session]);

  const login = async (libraryCard: string, pin: string, bookingUrl?: string) => {
    try {
      const response = await axios.post('/api/auth/login', {
        libraryCard,
        pin,
        bookingUrl,
      });

      if (response.data.success) {
        const newSession: AuthSession = {
          sessionId: response.data.sessionId,
          libraryCard: response.data.libraryCard,
          expiresAt: response.data.expiresAt,
        };

        setSession(newSession);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));

        return { success: true, sessionId: response.data.sessionId };
      } else {
        return {
          success: false,
          error: response.data.error || 'Login failed',
        };
      }
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Network error. Please try again.',
      };
    }
  };

  const logout = () => {
    if (session) {
      // Call logout API
      axios.post('/api/auth/logout', { sessionId: session.sessionId }).catch(console.error);
    }

    setSession(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const value: AuthContextType = {
    isAuthenticated: !!session,
    session,
    login,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
