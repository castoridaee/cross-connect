import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (type) => {
    // Immediate diagnostic check
    if (!supabase.supabaseKey) {
      console.error("Supabase Key is missing at the time of click!");
      alert("Configuration error: API key not found. Please refresh.");
      return;
    }

    setLoading(true);
    try {
      const { error } = type === 'LOGIN'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (error) throw error;
      alert(type === 'LOGIN' ? "Logged in!" : "Check your email for confirmation!");
    } catch (error) {
      alert(error.message);
      console.error("Auth error details:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-2xl border w-full max-w-sm shadow-xl">
      <h2 className="text-xl font-bold text-center">Save Your Progress</h2>
      <input
        type="email"
        placeholder="Email"
        className="p-3 border rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="p-3 border rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={() => handleAuth('LOGIN')}
          disabled={loading}
          className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? '...' : 'Login'}
        </button>
        <button
          onClick={() => handleAuth('SIGNUP')}
          disabled={loading}
          className="flex-1 border border-slate-900 py-3 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? '...' : 'Sign Up'}
        </button>
      </div>
    </div>
  );
}