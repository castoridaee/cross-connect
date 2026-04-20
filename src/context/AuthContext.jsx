import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  signOut: () => { },
  refreshUser: async () => { },
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const initializingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    async function initializeAuth() {
      if (initializingRef.current) return;
      initializingRef.current = true;

      try {
        // 1. Get current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (currentSession) {
          if (mountedRef.current) {
            setSession(currentSession);
            setUser(currentSession.user);
          }
        } else {
          // 2. Only sign in anonymously if no session exists
          const { data, error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError) throw anonError;

          if (mountedRef.current && data) {
            setSession(data.session);
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error("Auth Initialization Error:", err.message);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    initializeAuth();

    // Listener for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT' && !newSession) {
        setLoading(true);
        // Instantly replace the dead session with a fresh anonymous one
        const { data } = await supabase.auth.signInAnonymously();
        if (mountedRef.current && data) {
          setSession(data.session);
          setUser(data.user);
        }
        if (mountedRef.current) setLoading(false);
      } else {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    loading,
    signIn: async (email, password) => {
      // Capture the old guest ID before the session gets swapped out
      const oldGuestId = session?.user?.is_anonymous ? session.user.id : null;

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      // If login succeeded and we were previously an anonymous guest
      if (!error && data?.user && oldGuestId) {
        // Migrate all their guest data (puzzles, progress, etc.) over to their destination account
        await supabase.rpc('sync_guest_progress', {
          guest_id: oldGuestId,
          p_user_id: data.user.id
        });
      }

      return { data, error };
    },
    signUp: async (email, password, metadata) => {
      // If we're an anonymous guest, UPGRADE the user rather than creating a new identity
      if (session?.user?.is_anonymous) {
        const { data, error } = await supabase.auth.updateUser({
          email,
          password,
          data: metadata
        });

        // The PG trigger `handle_new_user` ONLY fires on row INSERT. Because `updateUser`
        // simply alters the row, we must manually apply our chosen username into `profiles`.
        if (!error && data?.user) {
          await supabase.from('profiles').update({
            username: metadata.username,
            locale: metadata.locale
          }).eq('id', data.user.id);
        }

        return { data, error };
      }

      // Standard fallback (e.g. if their session fully expired)
      return supabase.auth.signUp({
        email,
        password,
        options: { data: metadata }
      });
    },
    signOut: () => supabase.auth.signOut(),
    refreshUser: async () => {
      const { data: { user: updatedUser }, error } = await supabase.auth.getUser();
      if (!error && updatedUser && mountedRef.current) {
        setUser(updatedUser);
      }
      return { data: updatedUser, error };
    }
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