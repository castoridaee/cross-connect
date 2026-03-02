import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable, useDraggable } from '@dnd-kit/core';
import { WordTile } from '../components/WordTile';
import { WordBank } from '../components/WordBank';
import { supabase } from '../lib/supabase';
import { createPuzzle } from '../lib/puzzleService';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, Plus, Minus, X, Save, Trash2 } from 'lucide-react';

// Draggable tile for the grid editor
const EditorDraggableTile = ({ id, label, r, c, onEdit }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `editor-${id}-${r}-${c}`,
    data: { type: 'grid', r, c, word: label }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`relative group ${isDragging ? 'opacity-0' : 'opacity-100'}`}
      style={{ touchAction: 'none' }}
      onClick={(e) => {
        // Prevent trigger if it's just a click (DnD handles drag)
        // In dnd-kit, click is distinct from drag start
        onEdit(r, c);
      }}
    >
      <WordTile label={label} variant="active" />
    </div>
  );
};

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
      className={`cursor-pointer rounded-lg transition-transform active:scale-95 ${isOver ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
    >
      {word ? (
        <EditorDraggableTile id={word} label={word} r={r} c={c} onEdit={onEdit} />
      ) : (
        <WordTile label="" variant="ghost" />
      )}
    </div>
  );
};

// Draggable tile for the bank reordering
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

export default function CreatePuzzle({ onComplete, onCancel }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [grid, setGrid] = useState({}); // { "r-c": "WORD" }
  const [editingCell, setEditingCell] = useState(null);
  const [categories, setCategories] = useState([]);
  const [wordOrder, setWordOrder] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 } // Allow a bit of movement before drag starts
  }));

  const handleCellClick = (r, c) => {
    setEditingCell({ r, c, val: grid[`${r}-${c}`] || '' });
  };

  const saveCell = () => {
    if (!editingCell) return;
    const word = editingCell.val.trim().toUpperCase();
    const newGrid = { ...grid };

    if (word) {
      const exists = Object.entries(grid).find(([k, v]) => v === word && k !== `${editingCell.r}-${editingCell.c}`);
      if (exists) {
        alert("Word already exists in grid!");
        return;
      }
      newGrid[`${editingCell.r}-${editingCell.c}`] = word;
    } else {
      delete newGrid[`${editingCell.r}-${editingCell.c}`];
    }

    setGrid(newGrid);
    setEditingCell(null);
  };

  const deleteCell = (r, c) => {
    const newGrid = { ...grid };
    delete newGrid[`${r}-${c}`];
    setGrid(newGrid);
    setEditingCell(null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDrag(null);
    if (!over) return;

    if (active.data.current.type === 'grid' && over.data.current.type === 'grid') {
      const source = active.data.current;
      const target = over.data.current;
      if (source.r === target.r && source.c === target.c) return;

      const newGrid = { ...grid };
      const wordToMove = source.word;
      const wordAtTarget = grid[`${target.r}-${target.c}`];

      if (wordAtTarget) {
        newGrid[`${source.r}-${source.c}`] = wordAtTarget;
      } else {
        delete newGrid[`${source.r}-${source.c}`];
      }
      newGrid[`${target.r}-${target.c}`] = wordToMove;
      setGrid(newGrid);
    } else if (active.data.current.type === 'bank' && over.data.current.type === 'bank') {
      const activeWord = active.data.current.word;
      const overWord = over.data.current.word;
      if (activeWord === overWord) return;

      const oldIdx = wordOrder.indexOf(activeWord);
      const newIdx = wordOrder.indexOf(overWord);

      const newOrder = [...wordOrder];
      newOrder.splice(oldIdx, 1);
      newOrder.splice(newIdx, 0, activeWord);
      setWordOrder(newOrder);
    }
  };

  const resize = (axis, dir, side = 'end') => {
    const nextVal = (axis === 'rows' ? rows : cols) + dir;
    const maxVal = axis === 'rows' ? 7 : 5;
    if (nextVal < 2 || nextVal > maxVal) return;

    const newGrid = {};
    if (axis === 'rows') {
      Object.entries(grid).forEach(([k, v]) => {
        const [r, c] = k.split('-').map(Number);
        const newR = side === 'start' ? r + dir : r;
        if (newR >= 0 && newR < nextVal) newGrid[`${newR}-${c}`] = v;
      });
      setRows(nextVal);
    } else {
      Object.entries(grid).forEach(([k, v]) => {
        const [r, c] = k.split('-').map(Number);
        const newC = side === 'start' ? c + dir : c;
        if (newC >= 0 && newC < nextVal) newGrid[`${r}-${newC}`] = v;
      });
      setCols(nextVal);
    }
    setGrid(newGrid);
  };

  const detectGroups = () => {
    const groups = [];

    // Horizontal contiguous groups
    for (let r = 0; r < rows; r++) {
      let current = [];
      for (let c = 0; c < cols; c++) {
        const word = grid[`${r}-${c}`];
        if (word) current.push(word);
        else {
          if (current.length > 1) groups.push({ words: current, description: "" });
          current = [];
        }
      }
      if (current.length > 1) groups.push({ words: current, description: "" });
    }

    // Vertical contiguous groups
    for (let c = 0; c < cols; c++) {
      let current = [];
      for (let r = 0; r < rows; r++) {
        const word = grid[`${r}-${c}`];
        if (word) current.push(word);
        else {
          if (current.length > 1) groups.push({ words: current, description: "" });
          current = [];
        }
      }
      if (current.length > 1) groups.push({ words: current, description: "" });
    }

    return groups;
  };

  const goToStep2 = () => {
    const words = Object.values(grid);
    if (words.length < 4) return alert("Please add at least 4 words.");

    setCategories(detectGroups());
    setWordOrder([...new Set(words)].sort(() => Math.random() - 0.5));
    setStep(2);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const layout = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => grid[`${r}-${c}`] ? 1 : 0)
    );

    const puzzleData = {
      title: title.trim() || 'Untitled Puzzle',
      categories,
      layout,
      word_order: wordOrder,
      is_published: !!user,
      created_by: user?.id || null
    };

    const { error } = await createPuzzle(puzzleData);
    if (error) alert("Error saving puzzle: " + error.message);
    else {
      alert(user ? "Puzzle published!" : "Puzzle saved locally!");
      onComplete?.();
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-50 p-2 sm:p-4">
      <div className="w-full max-w-5xl bg-white sm:rounded-2xl shadow-lg p-3 sm:p-5 border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-black uppercase tracking-tight">
            {step === 1 ? 'Design Your Grid' : 'Finalize & Describe'}
          </h2>
          <div className="w-6" />
        </div>

        <DndContext sensors={sensors} onDragStart={e => setActiveDrag(e.active.data.current)} onDragEnd={handleDragEnd}>
          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Puzzle Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="My Cross-Connect"
                  className="text-2xl font-black border-b-4 border-slate-100 focus:border-indigo-500 outline-none pb-2 transition-colors tracking-tight"
                />
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="bg-slate-100 p-2 rounded-2xl border-2 border-slate-200 relative">
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category Descriptions</p>
                {categories.map((cat, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {cat.words.map(w => (
                        <span key={w} className="bg-white px-1.5 py-0.5 rounded text-[9px] font-black tracking-tight border border-slate-200">{w}</span>
                      ))}
                    </div>
                    <input
                      placeholder="e.g. Big Cats"
                      className="bg-transparent border-b border-slate-200 focus:border-indigo-500 outline-none text-xs font-bold pb-0.5 transition-colors"
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Word Bank (Drag to Reorder)</p>
                <WordBank>
                  {wordOrder.map(w => <BankDraggableTile key={w} label={w} />)}
                </WordBank>
              </div>

              <button disabled={isSubmitting} onClick={handleSubmit} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black tracking-widest hover:bg-indigo-700 transition-colors uppercase flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-lg shadow-indigo-100 mt-2">
                {isSubmitting ? 'SAVING...' : <><Save size={16} /> SUBMIT PUZZLE</>}
              </button>
            </div>
          )}
          <DragOverlay>
            {activeDrag && (
              <div className="opacity-80 scale-105">
                <WordTile label={activeDrag.word} variant="active" />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {editingCell && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 text-center">Update Word</h3>
            <input
              autoFocus className="w-full text-center text-3xl font-black uppercase tracking-tight border-b-4 border-indigo-500 outline-none pb-2 mb-2"
              value={editingCell.val} onChange={e => setEditingCell({ ...editingCell, val: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && saveCell()}
            />

            <button
              onClick={() => deleteCell(editingCell.r, editingCell.c)}
              className="w-full flex items-center justify-center gap-2 text-red-500 font-bold py-2 mb-4 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={16} /> Delete Word
            </button>

            <div className="flex gap-3">
              <button onClick={() => setEditingCell(null)} className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-2xl font-black">CANCEL</button>
              <button onClick={saveCell} className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-black shadow-lg shadow-indigo-200">SAVE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
