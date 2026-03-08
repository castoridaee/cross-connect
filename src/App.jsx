import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useAuth } from './context/AuthContext';
import PuzzleSolver from './pages/PuzzleSolver';
import CreatePuzzle from './pages/CreatePuzzle';
import AuthPage from './pages/AuthPage';
import AuthorProfile from './pages/AuthorProfile';
import { generateAnonymousName } from './utils/nameGenerator';
import { getPuzzle, recordPuzzleSkip, getPuzzleProgress, recordPuzzlePlay } from './lib/puzzleService';

function App() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('solve'); // 'solve', 'create', 'auth', 'author'
  const [pendingData, setPendingData] = useState(null);
  const [authorId, setAuthorId] = useState(null);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (authLoading) return;

    // 1. Function to parse current URL and set state
    const syncStateWithUrl = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      
      // Handle /a/[id] or ?a=[id]
      const profileId = path.startsWith('/a/') ? path.split('/a/')[1] : params.get('a');
      // Handle /p/[id] or ?p=[id]
      const puzzleId = path.startsWith('/p/') ? path.split('/p/')[1] : params.get('p');

      if (profileId) {
        setAuthorId(profileId);
        setView('author');
      } else if (puzzleId) {
        loadSpecificPuzzle(puzzleId);
      } else if (view === 'solve' && !puzzle) {
        loadPuzzles();
      } else if (view === 'solve' && puzzle) {
        refreshCurrentProgress(puzzle.id);
      }
    };

    // 2. Initial sync
    syncStateWithUrl();

    // 3. Listen for back/forward navigation
    window.addEventListener('popstate', syncStateWithUrl);
    return () => window.removeEventListener('popstate', syncStateWithUrl);
  }, [authLoading]); // Removed view/user dependencies to avoid loops, syncStateWithUrl handles internal logic

  // Update URL whenever view or specific IDs change
  useEffect(() => {
    if (authLoading) return;

    let newPath = '/';
    if (view === 'author' && authorId) {
      newPath = `/a/${authorId}`;
    } else if (view === 'solve' && puzzle) {
      newPath = `/p/${puzzle.id}`;
    } else if (view === 'create') {
      newPath = '/create';
    } else if (view === 'auth') {
      newPath = '/auth';
    }

    if (window.location.pathname !== newPath) {
      window.history.pushState({ view, authorId, puzzleId: puzzle?.id }, '', newPath);
    }
  }, [view, authorId, puzzle?.id, authLoading]);

  // Sync progress data whenever we enter solve view or user/puzzle changes
  useEffect(() => {
    if (view === 'solve' && puzzle?.id && !authLoading) {
      refreshCurrentProgress(puzzle.id);
    }
  }, [view, puzzle?.id, user?.id, authLoading]);

  async function refreshCurrentProgress(puzzleId) {
    if (!user) return;
    try {
      const { data } = await getPuzzleProgress(user.id, puzzleId);
      if (data) setProgress(data);
    } catch (err) {
      console.error("Failed to refresh progress:", err);
    }
  }

  async function loadSpecificPuzzle(id) {
    setLoading(true);
    try {
      let { data, error } = await getPuzzle(id);

      if (error) {
        console.warn("Specific fetch with join failed, retrying without join...", error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('puzzles')
          .select('*')
          .eq('id', id)
          .single();

        if (fallbackError) throw fallbackError;
        data = fallbackData;
      }

      if (data) {
        // Direct Access Security Check: Owners go to creator, others get "not found"
        if (data.is_published === false) {
          if (data.created_by === user?.id) {
            console.info("Redirecting owner to draft editor.");
            setPendingData(data);
            setView('create');
            return; // Exit early since we're switching views
          } else {
            console.warn("Direct access to unpublished puzzle denied.");
            throw new Error("Puzzle not found");
          }
        }

        let progData = null;
        if (user) {
          const { data: pData } = await getPuzzleProgress(user.id, data.id);
          progData = pData;
        }
        
        setProgress(progData);
        setPuzzle(data);
        setView('solve');
        
        if (user) {
          recordPuzzlePlay(user.id, data.id);
        }
      } else {
        throw new Error("Puzzle not found");
      }
    } catch (err) {
      console.error("Failed to load specific puzzle:", err);
      loadPuzzles(); // Fallback to random
    } finally {
      setLoading(false);
    }
  }

  async function loadPuzzles() {
    if (authLoading) return;
    setLoading(true);
    try {
      // 1. Get skipped OR solved puzzle IDs for current user
      let excludedIds = [];
      if (user) {
        const { data: progressData } = await supabase
          .from('user_progress')
          .select('puzzle_id')
          .eq('user_id', user.id)
          .in('status', ['skipped', 'solved']);
        excludedIds = progressData?.map(s => s.puzzle_id).filter(id => id) || [];
      }

      // 2. Get the total count of puzzles (excluding skipped/solved and unpublished)
      let countQuery = supabase
        .from('puzzles')
        .select('*', { count: 'exact', head: true })
        .eq('is_published', true);

      if (excludedIds.length > 0) {
        countQuery = countQuery.not('id', 'in', `(${excludedIds.join(',')})`);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error("Count Error:", countError);
        throw countError;
      }

      console.log("Found puzzles count:", count);

      if (count > 0) {
        // 3. Pick a random index
        const randomIndex = Math.floor(Math.random() * count);

        // 4. Fetch that specific puzzle with author nickname
        let fetchQuery = supabase
          .from('puzzles')
          .select('*, author:profiles!created_by(nickname)')
          .eq('is_published', true)
          .range(randomIndex, randomIndex);

        if (excludedIds.length > 0) {
          fetchQuery = fetchQuery.not('id', 'in', `(${excludedIds.join(',')})`);
        }

        let { data, error: fetchError } = await fetchQuery.single();

        if (fetchError) {
          console.warn("Fetch with join failed, retrying without join...", fetchError);
          // Fallback: Fetch without join
          let fallbackQuery = supabase
            .from('puzzles')
            .select('*')
            .eq('is_published', true)
            .range(randomIndex, randomIndex);

          if (excludedIds.length > 0) {
            fallbackQuery = fallbackQuery.not('id', 'in', `(${excludedIds.join(',')})`);
          }

          const { data: fallbackData, error: fallbackError } = await fallbackQuery.single();

          if (fallbackError) throw fallbackError;
          data = fallbackData;
        }

        if (data) {
          let progData = null;
          if (user) {
            const { data: pData } = await getPuzzleProgress(user.id, data.id);
            progData = pData;
          }
          setProgress(progData);
          setPuzzle(data);
          
          if (user) {
            recordPuzzlePlay(user.id, data.id);
          }
        }
      } else {
        // No more puzzles available (excluding solved/skipped)
        setPuzzle(null);
        setProgress(null);
      }
    } catch (err) {
      console.error("Load Error:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSkip = async () => {
    if (!puzzle || !user) {
      console.warn("Skip failed: No puzzle or user", { puzzle, user });
      return;
    }
    setLoading(true);
    console.log("Recording skip for puzzle:", puzzle.id, "user:", user.id);
    const { error } = await recordPuzzleSkip(user.id, puzzle.id);
    if (error) {
      console.error("Failed to record skip in DB:", error);
    } else {
      console.log("Skip recorded successfully");
    }
    loadPuzzles();
  };

  const handleNext = () => {
    // 1. Clear current puzzle/progress state
    setPuzzle(null);
    setProgress(null);
    
    // 2. Clear the URL to root
    window.history.pushState({ view: 'solve' }, '', '/');
    
    // 3. Load a new random, unsolved puzzle
    loadPuzzles();
  };

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
          <span className="font-black uppercase tracking-tighter text-sm max-w-[80px] leading-[0.85]">Cross Connect</span>
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
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {user.is_anonymous ? 'Playing as' : 'Logged in as'}
                </span>
                <span className="text-xs font-bold">
                  {user.is_anonymous
                    ? generateAnonymousName(user.id)
                    : (user.user_metadata?.nickname || user.email?.split('@')[0])}
                </span>
              </div>
              {user.is_anonymous ? (
                <button
                  onClick={() => setView('auth')}
                  className="bg-slate-900 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold tracking-widest hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
                >
                  SIGN IN
                </button>
              ) : (
                <button
                  onClick={() => signOut()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold transition-colors"
                >
                  LOGOUT
                </button>
              )}
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
              initialProgress={progress}
              onNavigateToCreate={() => setView('create')}
              onAuthorClick={(id) => {
                setAuthorId(id);
                setView('author');
              }}
              onSkip={handleSkip}
              onNext={handleNext}
            />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
              <p className="font-bold text-slate-400">No puzzles found.</p>
              <button onClick={() => setView('create')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-200">Create a Puzzle</button>
            </div>
          )
        ) : view === 'author' ? (
          <AuthorProfile
            authorId={authorId}
            currentUser={user}
            onEditPuzzle={(p) => {
              setPendingData({ ...p, grid: p.grid_data || {}, step: 1 });
              setView('create');
            }}
            onBack={() => setView('solve')}
            onNavigateToPuzzle={(p) => {
              setPuzzle(p);
              setView('solve');
            }}
          />
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