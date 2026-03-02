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

  const onReset = useCallback(() => {
    setGrid({});
    setHistory([]);
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
    state,
    handleMove,
    onCheck,
    onReset
  };
};
