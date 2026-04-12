import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  signOut: () => { },
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const initializingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      if (initializingRef.current) return;
      initializingRef.current = true;

      try {
        // 1. Get current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (currentSession) {
          if (mounted) {
            setSession(currentSession);
            setUser(currentSession.user);
          }
        } else {
          // 2. Only sign in anonymously if no session exists
          const { data, error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError) throw anonError;

          if (mounted && data) {
            setSession(data.session);
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error("Auth Initialization Error:", err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initializeAuth();

    // Listener for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, metadata) => supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    }),
    signOut: () => supabase.auth.signOut(),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse font-black text-slate-300">LOADING...</div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}