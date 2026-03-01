import { useState } from 'react';
import { supabase } from '../lib/supabase';

export const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (type) => {
    setLoading(true);
    const { error } = type === 'LOGIN'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) alert(error.message);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-2xl border w-full max-w-sm">
      <input
        type="email"
        placeholder="Email"
        className="p-3 border rounded-xl"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="p-3 border rounded-xl"
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={() => handleAuth('LOGIN')}
          disabled={loading}
          className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold"
        >
          Login
        </button>
        <button
          onClick={() => handleAuth('SIGNUP')}
          disabled={loading}
          className="flex-1 border border-slate-900 py-3 rounded-xl font-bold"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
};