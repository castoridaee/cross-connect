import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { validateUsername } from '../lib/puzzleService';

export default function AuthPage({ onComplete, onCancel, initialMode = 'login' }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const validation = await validateUsername(username);
        if (!validation.valid) throw new Error(validation.error);

        const { error: signUpError } = await signUp(email, password, {
          username,
          locale: navigator.language || 'en-US'
        });
        if (signUpError) {
          // If Supabase returns a uniqueness constraint error, obfuscate it to the same generic error
          if (signUpError.message?.toLowerCase().includes('already exists') || signUpError.code === '23505') {
            throw new Error('This username is unavailable.');
          }
          throw signUpError;
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) throw signInError;
      }
      onComplete?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-slate-100 relative overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-pink-50 rounded-full blur-3xl opacity-50" />

        <div className="relative z-10">
          <button onClick={onCancel} className="mb-8 text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            <ChevronLeft size={16} /> Back
          </button>

          <div className="mb-10">
            <p className="text-black-400 font-bold">
              {mode === 'login' ? 'Sign in to publish your puzzles and track your stats.' : 'Create an account to publish your puzzles and track your stats.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Your username"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500 transition-all font-bold"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="hello@example.com"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500 transition-all font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500 transition-all font-bold"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black tracking-widest hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase shadow-xl shadow-indigo-100 mt-6"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 text-center">
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              className="text-slate-400 font-bold hover:text-indigo-600 transition-colors"
            >
              {mode === 'login' ? (
                <>Don't have an account? <span className="text-slate-900">Sign Up</span></>
              ) : (
                <>Already have an account? <span className="text-slate-900">Sign In</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
