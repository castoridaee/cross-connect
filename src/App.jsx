import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useAuth } from './context/AuthContext';
import PuzzleSolver from './pages/PuzzleSolver';
import CreatePuzzle from './pages/CreatePuzzle';
import AuthPage from './pages/AuthPage';
import AuthorProfile from './pages/AuthorProfile';
import { getPuzzle, recordPuzzleSkip, getPuzzleProgress, recordPuzzlePlay, getRecommendedPuzzle } from './lib/puzzleService';
import logo from './assets/logo.svg';
import Avatar from "boring-avatars";

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
    if (authLoading || loading) return;

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
  }, [view, authorId, puzzle, authLoading, loading]);

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

  async function loadPuzzles(retryCount = 0) {
    if (authLoading) return;
    setLoading(true);
    try {
      const { data, error } = await getRecommendedPuzzle(user?.id);

      if (error) {
        console.error("Load Error:", error);
        if (retryCount < 1) {
          console.log("Retrying loadPuzzles in 1s...");
          setTimeout(() => loadPuzzles(retryCount + 1), 1000);
          return;
        }
        throw error;
      }

      if (data) {
        let progData = null;
        if (user) {
          const { data: pData } = await getPuzzleProgress(user.id, data.id);
          progData = pData;
        }
        setProgress(progData);
        setPuzzle(data);
      } else {
        // No more puzzles available
        setPuzzle(null);
        setProgress(null);
      }
    } catch (err) {
      console.error("Final Load Error:", err);
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
        initialMode={pendingData?.mode || 'login'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header / Global Nav */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 z-40 px-3 flex items-center">
        {/* Left Section: Logo */}
        <div className="flex-1 flex justify-start">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleNext}>
            <img src={logo} alt="Cross Connect Logo" className="w-8 h-8 object-contain" />
            <span className="font-black uppercase tracking-tighter text-sm max-w-[85px] leading-[0.85] hidden sm:block text-slate-900">Cross Connect</span>
          </div>
        </div>

        {/* Center Section: Navigation */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setView('solve')}
            className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors py-1 ${view === 'solve' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            SOLVE
          </button>
          <button
            onClick={() => { setPendingData(null); setView('create'); }}
            className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors py-1 ${view === 'create' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            CREATE
          </button>
        </div>

        {/* Right Section: User */}
        <div className="flex-1 flex justify-end">
          <div className="flex items-center gap-2 sm:gap-2">
            {user && !user.is_anonymous ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div
                  className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-slate-50 p-1 rounded-xl transition-all"
                  onClick={() => {
                    setAuthorId(user.id);
                    setView('author');
                  }}
                >
                  <Avatar
                    size={32}
                    name={user.id}
                    variant="beam"
                    colors={["#5cacc4", "#8cd19d", "#cee879", "#fcb653", "#ff5254"]}
                    square
                  />
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-xs font-black">
                      {user.user_metadata?.username || user.email?.split('@')[0]}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => signOut()}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold transition-colors"
                >
                  LOGOUT
                </button>
              </div>
            ) : (
              <button
                onClick={() => setView('auth')}
                className="bg-slate-900 text-white px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold tracking-widest hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap shadow-xl shadow-slate-100"
              >
                SIGN IN
              </button>
            )}
          </div>
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
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
              <h2 className="font-black text-xl text-slate-800 uppercase tracking-tight">No puzzles available</h2>
              <p className="text-slate-500 max-w-xs text-sm leading-relaxed">
                This might be a temporary connection issue, or maybe my code is bad.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  onClick={() => loadPuzzles()}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-slate-200 transition-transform active:scale-95"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setView('create')}
                  className="bg-white border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-colors hover:bg-slate-100"
                >
                  Create One
                </button>
              </div>
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
            onComplete={(data) => {
              const isRealUser = user && !user.is_anonymous;
              if (isRealUser) {
                setAuthorId(user.id);
                setView('author');
              } else {
                setView('solve');
                loadPuzzles();
              }
              setPuzzle(null);
              setProgress(null);
              setPendingData(null);
            }}
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