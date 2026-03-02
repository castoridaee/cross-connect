import React, { useState, useMemo } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { WordTile } from '../components/WordTile';
import { WordBank } from '../components/WordBank';
import { supabase } from '../lib/supabase';
import { createPuzzle } from '../lib/puzzleService';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, Plus, Minus, Check, Save } from 'lucide-react';

export default function CreatePuzzle({ onComplete, onCancel }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [grid, setGrid] = useState({}); // { "r-c": "WORD" }
  const [editingCell, setEditingCell] = useState(null);
  const [categories, setCategories] = useState([]); // Array of { words: [], description: "" }
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Grid Logic
  const handleCellClick = (r, c) => {
    setEditingCell({ r, c, val: grid[`${r}-${c}`] || '' });
  };

  const saveCell = () => {
    if (!editingCell) return;
    const word = editingCell.val.trim().toUpperCase();
    const newGrid = { ...grid };

    if (word) {
      // Check for duplicates
      const exists = Object.entries(grid).find(([k, v]) => v === word && k !== `${editingCell.r}-${editingCell.r}`);
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

  const resize = (axis, dir) => {
    if (axis === 'rows') {
      const next = Math.max(2, Math.min(8, rows + dir));
      setRows(next);
      // Clean up overflow data
      if (dir < 0) {
        const cleaned = {};
        Object.entries(grid).forEach(([k, v]) => {
          const [r] = k.split('-').map(Number);
          if (r < next) cleaned[k] = v;
        });
        setGrid(cleaned);
      }
    } else {
      const next = Math.max(2, Math.min(8, cols + dir));
      setCols(next);
      if (dir < 0) {
        const cleaned = {};
        Object.entries(grid).forEach(([k, v]) => {
          const [, c] = k.split('-').map(Number);
          if (c < next) cleaned[k] = v;
        });
        setGrid(cleaned);
      }
    }
  };

  // Step 2: Derive Categories
  const detectGroups = () => {
    const horizontal = [];
    for (let r = 0; r < rows; r++) {
      const rowWords = [];
      for (let c = 0; c < cols; c++) {
        if (grid[`${r}-${c}`]) rowWords.push(grid[`${r}-${c}`]);
      }
      if (rowWords.length > 1) horizontal.push({ words: rowWords, description: "" });
    }

    const vertical = [];
    for (let c = 0; c < cols; c++) {
      const colWords = [];
      for (let r = 0; r < rows; r++) {
        if (grid[`${r}-${c}`]) colWords.push(grid[`${r}-${c}`]);
      }
      if (colWords.length > 1) vertical.push({ words: colWords, description: "" });
    }

    return [...horizontal, ...vertical];
  };

  const goToStep2 = () => {
    const words = Object.values(grid);
    if (words.length < 4) {
      alert("Please add at least 4 words to your puzzle.");
      return;
    }
    if (!title.trim()) {
      alert("Please enter a title.");
      return;
    }
    setCategories(detectGroups());
    setStep(2);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Prepare layout: 2D array of 0s and 1s
    const layout = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => grid[`${r}-${c}`] ? 1 : 0)
    );

    const puzzleData = {
      title: title.trim(),
      categories: categories,
      layout: layout,
      word_order: Object.values(grid).sort(() => Math.random() - 0.5),
      is_published: !!user,
      created_by: user?.id || null
    };

    const { error } = await createPuzzle(puzzleData);
    if (error) {
      console.error(error);
      alert("Error saving puzzle: " + error.message);
    } else {
      alert(user ? "Puzzle published!" : "Puzzle saved locally! Log in to publish.");
      onComplete?.();
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-50 p-6">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-black uppercase tracking-tight">
            {step === 1 ? 'Design Your Grid' : 'Describe Categories'}
          </h2>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {step === 1 ? (
          <div className="space-y-8">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Puzzle Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="The Ultimate Cross-Connect"
                className="text-2xl font-black border-b-4 border-slate-100 focus:border-indigo-500 outline-none pb-2 transition-colors uppercase tracking-tight"
              />
            </div>

            <div className="flex items-center justify-center gap-4 py-4">
              {/* Row controls */}
              <div className="flex flex-col gap-2 scale-75 lg:scale-100">
                <button onClick={() => resize('rows', 1)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><Plus size={16} /></button>
                <div className="text-center font-black text-slate-300">{rows}</div>
                <button onClick={() => resize('rows', -1)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><Minus size={16} /></button>
              </div>

              <div className="bg-slate-100 p-4 rounded-2xl border-4 border-slate-200">
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                  {Array.from({ length: rows }).map((_, r) => (
                    Array.from({ length: cols }).map((_, c) => (
                      <div
                        key={`${r}-${c}`}
                        onClick={() => handleCellClick(r, c)}
                        className="cursor-pointer group"
                      >
                        {grid[`${r}-${c}`] ? (
                          <WordTile label={grid[`${r}-${c}`]} variant="active" />
                        ) : (
                          <WordTile label="" variant="ghost" />
                        )}
                      </div>
                    ))
                  ))}
                </div>
              </div>

              {/* Col controls */}
              <div className="flex gap-2 rotate-90 scale-75 lg:scale-100 lg:rotate-0">
                <button onClick={() => resize('cols', -1)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><Minus size={16} /></button>
                <div className="text-center font-black text-slate-300 w-4">{cols}</div>
                <button onClick={() => resize('cols', 1)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><Plus size={16} /></button>
              </div>
            </div>

            <button
              onClick={goToStep2}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black tracking-widest hover:bg-indigo-600 transition-colors uppercase"
            >
              Continue to Categories
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Defined Groups ({categories.length})</p>
              {categories.map((cat, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {cat.words.map(w => (
                      <span key={w} className="bg-white px-2 py-1 rounded text-[10px] font-black tracking-tight border border-slate-200">{w}</span>
                    ))}
                  </div>
                  <input
                    placeholder="Enter description for this group..."
                    className="bg-transparent border-b-2 border-slate-200 focus:border-indigo-500 outline-none text-sm font-bold pb-1 transition-colors"
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

            <button
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black tracking-widest hover:bg-indigo-700 transition-colors uppercase flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? 'SAVING...' : <><Save size={18} /> SUBMIT PUZZLE</>}
            </button>
          </div>
        )}
      </div>

      {editingCell && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 text-center">Enter Word</h3>
            <input
              autoFocus
              className="w-full text-center text-3xl font-black uppercase tracking-tight border-b-4 border-indigo-500 outline-none pb-2 mb-6"
              value={editingCell.val}
              onChange={e => setEditingCell({ ...editingCell, val: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && saveCell()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditingCell(null)}
                className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-2xl font-black"
              >
                CANCEL
              </button>
              <button
                onClick={saveCell}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-black shadow-lg shadow-indigo-200"
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
