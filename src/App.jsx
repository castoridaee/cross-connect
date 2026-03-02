import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useAuth } from './context/AuthContext';
import PuzzleSolver from './pages/PuzzleSolver';
import CreatePuzzle from './pages/CreatePuzzle';
import AuthPage from './pages/AuthPage';

function App() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('solve'); // 'solve', 'create', 'auth'
  const [pendingData, setPendingData] = useState(null);

  useEffect(() => {
    if (view === 'solve') {
      loadPuzzles();
    }
  }, [view]);

  async function loadPuzzles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('puzzles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) setPuzzle(data[0]);
    } catch (err) {
      console.error("Load Error:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleAuthComplete = () => {
    if (pendingData) {
      setView('create');
    } else {
      setView('solve');
    }
  };

  if (view === 'auth') {
    return (
      <AuthPage
        onComplete={handleAuthComplete}
        onCancel={() => setView(pendingData ? 'create' : 'solve')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header / Global Nav */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('solve')}>
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xl">C</div>
          <span className="font-black uppercase tracking-tighter text-sm">Cross Connect</span>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <button
            onClick={() => setView('solve')}
            className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors ${view === 'solve' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
          >
            SOLVE
          </button>
          <button
            onClick={() => { setPendingData(null); setView('create'); }}
            className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors ${view === 'create' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
          >
            CREATE
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {user && !user.is_anonymous ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logged in as</span>
                <span className="text-xs font-bold">{user.user_metadata?.nickname || user.email?.split('@')[0]}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold transition-colors"
              >
                LOGOUT
              </button>
            </div>
          ) : (
            <button
              onClick={() => setView('auth')}
              className="bg-slate-900 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold tracking-widest hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
            >
              SIGN IN
            </button>
          )}
        </div>
      </nav>

      <main className="pt-20">
        {view === 'solve' ? (
          (loading || authLoading) ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="animate-pulse font-black text-slate-200 text-4xl uppercase tracking-tighter">Loading...</div>
            </div>
          ) : puzzle ? (
            <PuzzleSolver
              puzzle={puzzle}
              user={user}
              onNavigateToCreate={() => setView('create')}
            />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
              <p className="font-bold text-slate-400">No puzzles found.</p>
              <button onClick={() => setView('create')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-200">Create First Puzzle</button>
            </div>
          )
        ) : (
          <CreatePuzzle
            onComplete={() => { setView('solve'); setPendingData(null); }}
            onCancel={() => setView('solve')}
            initialData={pendingData}
            onRequireAuth={(data) => {
              setPendingData(data);
              setView('auth');
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;