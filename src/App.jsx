import React, { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { validatePuzzle } from './utils/validator';
import { DraggableTile } from './components/DraggableTile';
import { GridDroppable } from './components/GridDroppable';
import { SuccessModal } from './components/SuccessModal';
import { WordBank } from './components/WordBank';
import { useAuth } from './context/AuthContext';
import { recordPuzzleSolve } from './lib/puzzleService';

const PUZZLE_DATA = {
  id: "db79dbb9-bc71-44c9-8078-91fe8b8b5245",
  words: ["LION", "LEOPARD", "CHEETAH", "DANZA", "HAWK", "TIGER"],
  layout: [[0, 1, 0, 0], [1, 1, 1, 1], [0, 1, 0, 0]],
  categories: [["TIGER", "LION", "LEOPARD", "CHEETAH"], ["TIGER", "DANZA", "HAWK"]]
};

export default function App() {
  const { user, loading } = useAuth();
  const [grid, setGrid] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [history, setHistory] = useState([]);
  const [state, setState] = useState({
    attempts: 0,
    moves: 0,
    solved: false,
    errors: [],
    startTime: Date.now()
  });

  const sensors = useSensors(useSensor(PointerSensor));

  const bankWords = PUZZLE_DATA.words.filter(w => !Object.values(grid).includes(w));
  const isGridFull = Object.values(grid).filter(Boolean).length === PUZZLE_DATA.words.length;

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (state.solved) return;

    const word = active.id;
    const sourceCoord = Object.keys(grid).find(k => grid[k] === word);

    if (!over || over.id === 'word-bank') {
      if (sourceCoord) {
        setGrid(prev => { const n = { ...prev }; delete n[sourceCoord]; return n; });
        setState(s => ({ ...s, moves: s.moves + 1 }));
      }
    } else if (over.id.startsWith('cell-')) {
      const target = over.id.replace('cell-', '');
      setGrid(prev => ({ ...prev, [sourceCoord]: prev[target], [target]: word }));
      setState(s => ({ ...s, moves: s.moves + 1 }));
    }
    setState(s => ({ ...s, errors: [] }));
  };

  const onCheck = async () => {
    const result = validatePuzzle(grid, PUZZLE_DATA);
    const currentAttempt = state.attempts + 1;

    if (result.solved) {
      const endTime = Date.now();
      const secondsElapsed = Math.floor((endTime - state.startTime) / 1000);

      setState(s => ({ ...s, solved: true, attempts: currentAttempt }));

      if (user) {
        try {
          await recordPuzzleSolve(user.id, PUZZLE_DATA.id, {
            attempts: currentAttempt,
            moves: state.moves,
            seconds: secondsElapsed
          });
          console.log("Analytics synced.");
        } catch (err) {
          console.error("Sync Error:", err.message);
        }
      }
    } else {
      if (result.messages.length > 0) {
        setHistory(prev => [{ attempt: currentAttempt, messages: result.messages }, ...prev]);
      }
      setState(s => ({ ...s, attempts: currentAttempt, errors: result.errors }));
    }
  };

  const onReset = () => {
    setGrid({});
    setState(prev => ({ ...prev, solved: false, errors: [] }));
    setHistory([]);
    setActiveId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-pulse font-black text-slate-300 tracking-widest">LOADING SESSION...</div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={e => setActiveId(e.active.id)} onDragEnd={handleDragEnd}>
      <div className="flex flex-col items-center min-h-screen bg-slate-50 p-6 select-none">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tighter uppercase">Cross-Connected</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Attempts: {state.attempts}</p>
        </header>

        <section className="grid grid-rows-4 gap-2 mb-8">
          {PUZZLE_DATA.layout.map((row, r) => (
            <div key={r} className="flex gap-2">
              {row.map((active, c) => active ? (
                <GridDroppable key={`${r}-${c}`} id={`cell-${r}-${c}`} word={grid[`${r}-${c}`]}
                  isError={state.errors.includes(`${r}-${c}`)} activeDrag={activeId === grid[`${r}-${c}`]} />
              ) : <div key={`${r}-${c}`} className="w-16 h-16" />)}
            </div>
          ))}
        </section>

        <WordBank>
          {bankWords.map(w => <DraggableTile key={w} id={w} label={w} />)}
        </WordBank>

        <div className="w-full max-w-xs flex flex-col gap-3 mb-8">
          <button
            onClick={onCheck}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black tracking-widest transition-all active:scale-95 active:bg-slate-700 select-none"
          >
            {isGridFull ? 'SUBMIT' : 'CHECK'}
          </button>

          <button
            onClick={onReset}
            className="w-full bg-slate-200 text-slate-700 py-3 rounded-2xl font-bold tracking-widest transition-all active:scale-95 hover:bg-slate-300 select-none text-xs uppercase"
          >
            Reset Puzzle
          </button>
        </div>

        <section className="w-full max-w-md flex flex-col gap-2">
          {history.map((entry) => (
            <div key={entry.attempt} className="p-3 border-l-4 shadow-sm border-red-500 bg-red-50 text-red-900">
              <span className="text-[10px] font-black uppercase block mb-1">Attempt {entry.attempt} Mistakes</span>
              {entry.messages.map((msg, i) => (
                <div key={i} className="text-xs font-bold">{msg}</div>
              ))}
            </div>
          ))}
        </section>

        <DragOverlay>
          {activeId && <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center font-bold rounded-lg shadow-2xl rotate-2 text-[9px] uppercase">{activeId}</div>}
        </DragOverlay>

        {state.solved && <SuccessModal attempts={state.attempts} />}
      </div>
    </DndContext>
  );
}