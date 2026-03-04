import { useState, useCallback } from 'react';
import { validatePuzzle } from '../utils/validator';
import { recordPuzzleSolve } from '../lib/puzzleService';

export const usePuzzleGame = (puzzle, user) => {
  const [grid, setGrid] = useState({});
  const [history, setHistory] = useState([]);
  const [state, setState] = useState({
    attempts: 0,
    moves: 0,
    solved: false,
    errors: [],
    startTime: Date.now()
  });

  const [hints, setHints] = useState([]); // [{ index: categoryIndex, level: 1|2 }]

  const onReset = useCallback(() => {
    setGrid({});
    setHistory([]);
    setHints([]);
    setState(s => ({
      ...s,
      attempts: 0,
      moves: 0,
      solved: false,
      errors: [],
      startTime: Date.now()
    }));
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

    // 1. Identify which categories are currently "solved" on the board
    // A category is solved if its words form a contiguous block matching its definition
    const solvedIndices = puzzle.categories.map((cat, idx) => {
      const hasOnBoard = Object.values(grid).filter(w => cat.words.includes(w)).length === cat.words.length;
      if (!hasOnBoard) return false;

      // Basic check: is there ANY contiguous group on the grid that matches this category's words?
      // For simplicity, we'll check if if the category words exist in a single group
      const matchingCat = puzzle.categories.find(c =>
        c.words.length === cat.words.length && c.words.every(w => cat.words.includes(w))
      );
      return !!matchingCat;
    }).map((val, idx) => val ? idx : -1).filter(idx => idx !== -1);

    // 2. Prioritize Tier 1 (Names) then Tier 2 (Counts)
    const tier1Given = hints.filter(h => h.level === 1).map(h => h.index);
    const tier2Given = hints.filter(h => h.level === 2).map(h => h.index);

    let level = 1;
    let candidates = puzzle.categories.map((_, i) => i).filter(i => !tier1Given.includes(i));

    if (candidates.length === 0) {
      level = 2;
      candidates = puzzle.categories.map((_, i) => i).filter(i => !tier2Given.includes(i));
    }

    if (candidates.length === 0) return;

    // 3. Prioritize non-solved categories
    const unsolvedCandidates = candidates.filter(i => !solvedIndices.includes(i));
    const selectionSource = unsolvedCandidates.length > 0 ? unsolvedCandidates : candidates;

    // 4. pick random
    const randomIndex = selectionSource[Math.floor(Math.random() * selectionSource.length)];
    setHints(prev => [...prev, { index: randomIndex, level }]);
  }, [grid, hints, puzzle, state.solved]);

  const onCheck = useCallback(async () => {
    const result = validatePuzzle(grid, puzzle);
    const currentAttempt = state.attempts + 1;

    if (result.solved) {
      const seconds = Math.floor((Date.now() - state.startTime) / 1000);
      setState(s => ({ ...s, solved: true, attempts: currentAttempt }));

      if (user) {
        await recordPuzzleSolve(user.id, puzzle.id, {
          attempts: currentAttempt,
          moves: state.moves,
          seconds: seconds
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
    handleMove,
    onCheck,
    onHint,
    onReset
  };
};
