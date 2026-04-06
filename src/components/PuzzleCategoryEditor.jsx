import React from 'react';
import { Save } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { WordBank } from './WordBank';
import { WordTile } from './WordTile';

const BankDraggableTile = ({ label }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bank-${label}`,
    data: { type: 'bank', word: label }
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `bank-drop-${label}`,
    data: { type: 'bank', word: label }
  });

  return (
    <div
      ref={(node) => { setNodeRef(node); setDroppableRef(node); }}
      {...listeners}
      {...attributes}
      className={`relative ${isDragging ? 'opacity-20' : 'opacity-100'} ${isOver ? 'scale-110' : ''} transition-all`}
      style={{ touchAction: 'none' }}
    >
      <WordTile label={label} />
    </div>
  );
};

export function PuzzleCategoryEditor({
  categories,
  setCategories,
  wordOrder,
  isSubmitting,
  handleSubmit,
  initialComment,
  setInitialComment
}) {
  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Category Descriptions</p>
          {categories.map((cat, idx) => (
            <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
              <div className="flex gap-1.5 flex-wrap">
                {cat.words.map(w => (
                  <span key={w} className="bg-white px-1.5 py-0.5 rounded text-xs font-black tracking-tight border border-slate-200">{w}</span>
                ))}
              </div>
              <input
                placeholder="Description"
                className="bg-transparent border-b border-slate-200 focus:border-indigo-500 outline-none text-sm font-bold pb-0.5 transition-colors"
                value={cat.description}
                onChange={e => {
                  const next = [...categories];
                  next[idx].description = e.target.value;
                  setCategories(next);
                }}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Post a Comment</p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
            <textarea
              value={initialComment}
              onChange={e => setInitialComment(e.target.value)}
              placeholder="Optional: add in a comment to show up after the puzzle is solved. For example, to give any commentary on this puzzle, or to leave a message for the people who solve it."
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 transition-all min-h-[100px] resize-none"
            />
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Word Bank (Drag to Reorder)</p>
          <WordBank>
            {wordOrder.map(w => <BankDraggableTile key={w} label={w} />)}
          </WordBank>
        </div>
      </div>

      <button disabled={isSubmitting} onClick={handleSubmit} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black tracking-widest hover:bg-slate-800 transition-all active:scale-95 uppercase flex items-center justify-center gap-2 disabled:opacity-50 text-base shadow-lg shadow-slate-100 mt-8">
        {isSubmitting ? 'SAVING...' : <><Save size={16} /> SUBMIT PUZZLE</>}
      </button>
    </>
  );
}
