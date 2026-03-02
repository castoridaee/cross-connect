import React, { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { usePuzzleGame } from '../hooks/usePuzzleGame';
import { GridDroppable } from '../components/GridDroppable';
import { DraggableTile } from '../components/DraggableTile';
import { WordBank } from '../components/WordBank';
import { SuccessModal } from '../components/SuccessModal';
import { Plus } from 'lucide-react';

export default function PuzzleSolver({ puzzle, user, onNavigateToCreate }) {
  const { grid, history, state, handleMove, onCheck, onReset } = usePuzzleGame(puzzle, user);
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor));

  const allWords = puzzle.word_order?.length > 0
    ? puzzle.word_order
    : [...new Set(puzzle.categories.flatMap(cat => cat.words))];

  const bankWords = allWords.filter(w => !Object.values(grid).includes(w));
  const isGridFull = Object.values(grid).filter(Boolean).length === allWords.length;

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    const word = active.id;
    const sourceCoord = Object.keys(grid).find(k => grid[k] === word);

    if (!over || over.id === 'word-bank') {
      handleMove(sourceCoord, null, word);
    } else if (over.id.startsWith('cell-')) {
      const targetCoord = over.id.replace('cell-', '');
      handleMove(sourceCoord, targetCoord, word);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={e => setActiveId(e.active.id)} onDragEnd={handleDragEnd}>
      <div className="flex flex-col items-center min-h-screen bg-slate-50 p-6 select-none relative">
        <button
          onClick={onNavigateToCreate}
          className="absolute top-6 right-6 bg-white border border-slate-200 text-slate-800 p-3 rounded-2xl shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
        >
          <Plus size={16} /> New Puzzle
        </button>

        <header className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tighter uppercase">Cross-Connect</h1>
          <div className="flex flex-col items-center gap-1 mt-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{puzzle.title}</p>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Attempts: {state.attempts}</p>
          </div>
        </header>

        <section className="grid gap-2 mb-8">
          {puzzle.layout.map((row, r) => (
            <div key={r} className="flex gap-2">
              {row.map((active, c) => active ? (
                <GridDroppable
                  key={`${r}-${c}`}
                  id={`cell-${r}-${c}`}
                  word={grid[`${r}-${c}`]}
                  isError={state.errors.includes(`${r}-${c}`)}
                  activeDrag={activeId === grid[`${r}-${c}`]}
                />
              ) : (
                <div key={`${r}-${c}`} className="w-16 h-16" />
              ))}
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
          {activeId && (
            <div className="w-16 h-16 bg-indigo-600 text-white flex items-center justify-center font-bold rounded-lg shadow-2xl rotate-2 text-[9px] uppercase">
              {activeId}
            </div>
          )}
        </DragOverlay>

        {state.solved && <SuccessModal attempts={state.attempts} />}
      </div>
    </DndContext>
  );
}
