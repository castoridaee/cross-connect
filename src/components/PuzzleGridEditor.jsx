import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { WordTile } from './WordTile';
import { EditorDraggableTile } from './EditorDraggableTile';

// Droppable cell for the editor
const EditorCell = ({ r, c, word, onCellClick, onEdit }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${r}-${c}`,
    data: { type: 'grid', r, c }
  });

  return (
    <div
      ref={setNodeRef}
      onClick={() => !word && onCellClick(r, c)}
      className={`w-16 h-16 border-r-2 border-b-2 border-black overflow-hidden cursor-pointer transition-transform active:scale-95 ${isOver ? 'ring-2 ring-indigo-400 ring-offset-2 z-10' : ''}`}
    >
      {word ? (
        <EditorDraggableTile id={word} label={word} r={r} c={c} onEdit={onEdit} />
      ) : (
        <WordTile label="" variant="dark" inGrid={true} />
      )}
    </div>
  );
};

export function PuzzleGridEditor({
  title,
  setTitle,
  rows,
  cols,
  grid,
  handleCellClick,
  resize,
  goToStep2
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Puzzle Title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="text-2xl font-black border-b-4 border-slate-100 focus:border-indigo-500 outline-none pb-2 transition-colors tracking-tight"
        />
        <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 italic">
          {('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 'Tap' : 'Click'} the black grid below to start adding words.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="w-full relative px-0 mb-4">
          <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none opacity-50" />
          <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none opacity-50" />

          <div className="overflow-x-auto pb-4 custom-scrollbar text-center">
            <div className="inline-block min-w-max mx-auto">
              <div className="relative">
                <div className="grid gap-0 border-t-2 border-l-2 border-black relative" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                  {Array.from({ length: rows }).map((_, r) => (
                    Array.from({ length: cols }).map((_, c) => (
                      <EditorCell
                        key={`${r}-${c}`} r={r} c={c} word={grid[`${r}-${c}`]}
                        onCellClick={handleCellClick} onEdit={handleCellClick}
                      />
                    ))
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6 bg-slate-50 p-3 rounded-2xl border border-slate-100 w-full">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Height</span>
            <div className="flex gap-1">
              <button onClick={() => resize('rows', -1, 'end')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"><Minus size={14} /></button>
              <button onClick={() => resize('rows', 1, 'end')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"><Plus size={14} /></button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Width</span>
            <div className="flex gap-1">
              <button onClick={() => resize('cols', -1, 'end')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"><Minus size={14} /></button>
              <button onClick={() => resize('cols', 1, 'end')} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"><Plus size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      <button onClick={goToStep2} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black tracking-widest hover:bg-indigo-600 transition-colors uppercase">
        Continue to Categories
      </button>
    </div>
  );
}
