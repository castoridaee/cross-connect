import { useState, useCallback, useEffect, useRef } from 'react';
import { validatePuzzle } from '../utils/validator';
import { recordPuzzleSolve, savePuzzleProgress, togglePuzzleLike } from '../lib/puzzleService';

export const usePuzzleGame = (puzzle, user, initialProgress = null) => {
  // 1. Initialize state from saved progress if available
  const [grid, setGrid] = useState(initialProgress?.grid_state || {});
  const [history, setHistory] = useState(initialProgress?.guess_history || []);
  const [hints, setHints] = useState(initialProgress?.hints_revealed || []); 
  const [isLiked, setIsLiked] = useState(initialProgress?.is_liked || false);
  const [isFlashing, setIsFlashing] = useState(false);
  
  const [state, setState] = useState({
    attempts: initialProgress?.attempts || 0,
    moves: initialProgress?.move_count || 0,
    solved: initialProgress?.status === 'solved',
    errors: [],
    seconds: initialProgress?.total_seconds_played || 0
  });

  // Timer logic - only run if not solved
  useEffect(() => {
    if (state.solved) return;

    let timer;
    const updateTimer = () => {
      // Only increment if the tab is visible
      if (document.visibilityState === 'visible') {
        setState(s => ({ ...s, seconds: s.seconds + 1 }));
      }
    };

    timer = setInterval(updateTimer, 1000);

    // Also listen for visibility changes to pause/resume more accurately if needed
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearInterval(timer);
      } else {
        timer = setInterval(updateTimer, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.solved]);

  // Auto-save logic for interactions (grid, moves, attempts, hints, history)
  const lastSavedState = useRef(JSON.stringify({ grid, attempts: state.attempts, moves: state.moves, hints, history }));
  useEffect(() => {
    if (!user || state.solved) return;

    const currentInteractionState = JSON.stringify({ grid, attempts: state.attempts, moves: state.moves, hints, history });
    if (currentInteractionState === lastSavedState.current) return;

    const interactionTimer = setTimeout(async () => {
      console.log("Auto-saving interaction progress (with hints/history)...");
      await savePuzzleProgress(user.id, puzzle.id, {
        grid,
        attempts: state.attempts,
        moves: state.moves,
        seconds: state.seconds,
        hints,
        history
      });
      lastSavedState.current = currentInteractionState;
    }, 2000); // 2 second debounce for typing/dragging

    return () => clearTimeout(interactionTimer);
  }, [grid, state.attempts, state.moves, hints, history, user, puzzle.id, state.solved]);

  // Periodic heartbeat save for the timer (every 15 seconds)
  useEffect(() => {
    if (!user || state.solved) return;

    const heartbeatTimer = setInterval(async () => {
      console.log("Heartbeat: Saving play time...");
      await savePuzzleProgress(user.id, puzzle.id, {
        grid,
        attempts: state.attempts,
        moves: state.moves,
        seconds: state.seconds,
        hints,
        history
      });
    }, 15000);

    return () => clearInterval(heartbeatTimer);
  }, [user, puzzle.id, state.solved, grid, state.attempts, state.moves, state.seconds]);

  // Final safety: Save on tab close/unload
  useEffect(() => {
    if (!user || state.solved) return;

    const handleUnload = () => {
      // Use navigator.sendBeacon or a synchronous-ish fetch if needed, 
      // but Supabase/PostgREST typically needs a normal fetch.
      // Since this is a small update, we'll just try a standard call.
      savePuzzleProgress(user.id, puzzle.id, {
        grid,
        attempts: state.attempts,
        moves: state.moves,
        seconds: state.seconds,
        hints,
        history
      });
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user, puzzle.id, state.solved, grid, state.attempts, state.moves, state.seconds]);
  // Note: We keep state.seconds in the heartbeat so it resets the interval correctly or we just rely on the interval.
  // Actually, for heartbeat, it's better to NOT have state.seconds in deps, just a pure interval.

  // Sync state when puzzle changes or initialProgress is updated
  useEffect(() => {
    const newGrid = initialProgress?.grid_state || {};
    const newHistory = initialProgress?.guess_history || [];
    const newHints = initialProgress?.hints_revealed || [];
    const newState = {
      attempts: initialProgress?.attempts || 0,
      moves: initialProgress?.move_count || 0,
      solved: initialProgress?.status === 'solved',
      errors: [],
      seconds: initialProgress?.total_seconds_played || 0
    };

    setGrid(newGrid);
    setHistory(newHistory);
    setHints(newHints);
    setIsLiked(initialProgress?.is_liked || false);
    setState(newState);
    lastSavedState.current = JSON.stringify({ grid: newGrid, attempts: newState.attempts, moves: newState.moves, hints: newHints, history: newHistory });
  }, [puzzle.id, initialProgress?.id, initialProgress?.updated_at]); // Support refreshing same puzzle

  const onReset = useCallback(() => {
    setGrid({});
    setHistory([]);
    setHints([]);
    setState({
      attempts: 0,
      moves: 0,
      solved: false,
      errors: [],
      seconds: 0
    });
  }, []);

  const handleMove = useCallback((sourceCoord, targetCoord, word) => {
    if (state.solved) return;

    setGrid(prev => {
      const next = { ...prev };
      if (!targetCoord) {
        if (sourceCoord) delete next[sourceCoord];
      } else {
        if (sourceCoord) next[sourceCoord] = prev[targetCoord];
        next[targetCoord] = word;
      }
      return next;
    });
    setState(s => ({ ...s, moves: s.moves + 1, errors: [] }));
  }, [state.solved]);

  const onHint = useCallback(() => {
    if (state.solved || hints.length >= puzzle.categories.length * 2) return;

    const solvedIndices = puzzle.categories.map((cat, idx) => {
      const hasOnBoard = Object.values(grid).filter(w => cat.words.includes(w)).length === cat.words.length;
      if (!hasOnBoard) return false;
      const matchingCat = puzzle.categories.find(c =>
        c.words.length === cat.words.length && c.words.every(w => cat.words.includes(w))
      );
      return !!matchingCat;
    }).map((val, idx) => val ? idx : -1).filter(idx => idx !== -1);

    const tier1Given = hints.filter(h => h.level === 1).map(h => h.index);
    const tier2Given = hints.filter(h => h.level === 2).map(h => h.index);

    let level = 1;
    let candidates = puzzle.categories.map((_, i) => i).filter(i => !tier1Given.includes(i));

    if (candidates.length === 0) {
      level = 2;
      candidates = puzzle.categories.map((_, i) => i).filter(i => !tier2Given.includes(i));
    }

    if (candidates.length === 0) return;

    const unsolvedCandidates = candidates.filter(i => !solvedIndices.includes(i));
    const selectionSource = unsolvedCandidates.length > 0 ? unsolvedCandidates : candidates;

    const randomIndex = selectionSource[Math.floor(Math.random() * selectionSource.length)];
    setHints(prev => [...prev, { index: randomIndex, level }]);
  }, [grid, hints, puzzle, state.solved]);

  const onToggleLike = useCallback(async () => {
    if (!user) return;
    const { data, error } = await togglePuzzleLike(puzzle.id, user.id);
    if (!error) {
      setIsLiked(data);
    }
  }, [user, puzzle.id]);

  const onCheck = useCallback(async () => {
    // Check if any active layout cells are empty
    const isEmptyAny = puzzle.layout.some((row, r) => 
      row.some((active, c) => active && !grid[`${r}-${c}`])
    );

    if (isEmptyAny) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 500);
    }

    const result = validatePuzzle(grid, puzzle);
    const currentAttempt = state.attempts + 1;

    if (result.solved) {
      setState(s => ({ ...s, solved: true, attempts: currentAttempt }));

      if (user) {
        await recordPuzzleSolve(user.id, puzzle.id, {
          attempts: currentAttempt,
          moves: state.moves,
          seconds: state.seconds,
          grid: grid,
          hints: hints,
          history: history
        });
      }
    } else {
      if (result.messages.length > 0) {
        setHistory(prev => [{ attempt: currentAttempt, messages: result.messages }, ...prev]);
      }
      setState(s => ({ ...s, attempts: currentAttempt, errors: result.errors }));
    }
  }, [grid, puzzle, state, user]);

  return {
    grid,
    history,
    hints,
    state,
    isFlashing,
    isLiked,
    handleMove,
    onCheck,
    onHint,
    onReset,
    onToggleLike
  };
};
