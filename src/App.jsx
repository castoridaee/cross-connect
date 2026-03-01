import React, { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { validatePuzzle } from './utils/validator';
import { DraggableTile } from './components/DraggableTile';
import { GridDroppable } from './components/GridDroppable';
import { SuccessModal } from './components/SuccessModal';

const PUZZLE_DATA = {
  words: ["LION", "LEOPARD", "CHEETAH", "DANZA", "HAWK", "TIGER"],
  layout: [[0, 1, 0, 0], [1, 1, 1, 1], [0, 1, 0, 0], [0, 0, 0, 0]],
  intersection: "1-1",
  hCoords: ["1-0", "1-1", "1-2", "1-3"],
  vCoords: ["0-1", "1-1", "2-1"],
  catA: ["TIGER", "LION", "LEOPARD", "CHEETAH"],
  catB: ["TIGER", "DANZA", "HAWK"]
};

export default function App() {
  const [grid, setGrid] = useState({});
  const [state, setState] = useState({ attempts: 0, solved: false, errors: [], messages: [] });
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor));
  const bankWords = PUZZLE_DATA.words.filter(w => !Object.values(grid).includes(w));

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (state.solved || !over) return;

    const word = active.id;
    const sourceCoord = Object.keys(grid).find(k => grid[k] === word);

    if (over.id === 'word-bank') {
      if (sourceCoord) setGrid(prev => { const n = { ...prev }; delete n[sourceCoord]; return n; });
    } else {
      const target = over.id.replace('cell-', '');
      setGrid(prev => ({ ...prev, [sourceCoord]: prev[target], [target]: word }));
    }
    setState(s => ({ ...s, errors: [], messages: [] }));
  };

  const onCheck = () => {
    const result = validatePuzzle(grid, PUZZLE_DATA);
    setState(s => ({ ...s, ...result, attempts: s.attempts + 1 }));
  };

  return (
    <DndContext sensors={sensors} onDragStart={e => setActiveId(e.active.id)} onDragEnd={handleDragEnd}>
      <div className="flex flex-col items-center min-h-screen bg-slate-50 p-6 select-none">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tighter uppercase">Cross-Connect</h1>
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

        <div className="w-full max-w-sm mb-6 space-y-2">
          {state.messages.map((m, i) => (
            <div key={i} className="p-3 bg-white border-l-4 border-slate-900 shadow-sm text-[10px] font-bold uppercase italic">
              {m.text}
            </div>
          ))}
        </div>

        <footer id="word-bank" className="flex flex-wrap justify-center gap-2 max-w-md p-6 bg-white rounded-3xl border mb-10 min-h-[100px]">
          {bankWords.map(w => <DraggableTile key={w} id={w} label={w} />)}
        </footer>

        <button onClick={onCheck} className="w-full max-w-xs bg-slate-900 text-white py-4 rounded-2xl font-black tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl">
          SUBMIT
        </button>

        <DragOverlay>
          {activeId && <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center font-bold rounded-lg shadow-2xl rotate-2 text-[9px] uppercase">{activeId}</div>}
        </DragOverlay>

        {state.solved && <SuccessModal attempts={state.attempts} />}
      </div>
    </DndContext>
  );
}