import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import CreatePuzzle from './pages/CreatePuzzle';
import PuzzleSolver from './pages/PuzzleSolver';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [puzzle, setPuzzle] = useState(null);
  const [view, setView] = useState('solve'); // 'solve' or 'create'

  useEffect(() => {
    let isMounted = true;

    async function loadPuzzle() {
      const { data, error } = await supabase
        .from('puzzles')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error("Supabase API Error:", error.message);
        return;
      }

      if (data) {
        setPuzzle(data);
      }
    }

    if (view === 'solve') loadPuzzle();
    return () => { isMounted = false; };
  }, [view]);

  if (view === 'create') {
    return (
      <CreatePuzzle
        onComplete={() => setView('solve')}
        onCancel={() => setView('solve')}
      />
    );
  }

  if (authLoading || !puzzle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-6">
        <div className="animate-pulse font-black text-slate-300 tracking-widest uppercase">
          {authLoading ? 'Initializing Session...' : 'Fetching Puzzle...'}
        </div>
        {!authLoading && !puzzle && (
          <button
            onClick={() => setView('create')}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest"
          >
            Create First Puzzle
          </button>
        )}
      </div>
    );
  }

  return (
    <PuzzleSolver
      puzzle={puzzle}
      user={user}
      onNavigateToCreate={() => setView('create')}
    />
  );
}