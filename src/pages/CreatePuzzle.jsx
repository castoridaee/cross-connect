import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable, useDraggable } from '@dnd-kit/core';
import { WordTile } from '../components/WordTile';
import { WordBank } from '../components/WordBank';
import { supabase } from '../lib/supabase';
import { createPuzzle, updatePuzzle } from '../lib/puzzleService';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, Plus, Minus, X, Save, Trash2, Check } from 'lucide-react';
import { PublishSuccessModal } from '../components/PublishSuccessModal';

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
      className={`w-full h-full relative group ${isDragging ? 'opacity-0' : 'opacity-100'}`}
      style={{ touchAction: 'none' }}
      onClick={(e) => {
        // Prevent trigger if it's just a click (DnD handles drag)
        // In dnd-kit, click is distinct from drag start
        onEdit(r, c);
      }}
    >
      <WordTile label={label} variant="active" inGrid={true} />
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

export default function CreatePuzzle({ onComplete, onCancel, initialData, onRequireAuth }) {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState(initialData?.id || null);
  const [step, setStep] = useState(initialData?.step || 1);
  const [title, setTitle] = useState(initialData?.title || '');
  const [rows, setRows] = useState(initialData?.rows || initialData?.layout?.length || 4);
  const [cols, setCols] = useState(initialData?.cols || initialData?.layout?.[0]?.length || 4);
  const [grid, setGrid] = useState(initialData?.grid || initialData?.grid_data || {});
  const [editingCell, setEditingCell] = useState(null);
  const [categories, setCategories] = useState(initialData?.categories || []);
  const [wordOrder, setWordOrder] = useState(initialData?.word_order || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [publishedId, setPublishedId] = useState(initialData?.publishedId || null);
  const [isPublishSuccess, setIsPublishSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // iterative draft saving
  useEffect(() => {
    if (!user) return;
    
    // Auto-save logic
    const wordCount = Object.keys(grid).length;
    const hasContent = title.trim() || wordCount > 0 || categories.length > 0;
    
    // Don't autosave if we're in the middle of a check or if published successfully in this session
    if (hasContent && !isSubmitting && !isPublishSuccess) {
      setIsSaving(true);
      const timer = setTimeout(async () => {
        const defaultTitle = new Date().toLocaleString([], { 
          month: 'short', day: 'numeric', year: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        });
        
        const payload = {
          title: title.trim() || defaultTitle,
          grid_data: grid,
          layout: Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => grid[`${r}-${c}`] ? 1 : 0)
          ),
          categories: categories,
          word_order: wordOrder,
          is_published: initialData?.is_published || false,
          created_by: user.id
        };
        
        try {
          if (editingId) {
            await updatePuzzle(editingId, payload);
          } else {
            const { data } = await createPuzzle(payload);
            if (data?.id) setEditingId(data.id);
          }
          setLastSavedAt(new Date());
        } catch (err) {
          console.error("Autosave error:", err);
        } finally {
          setIsSaving(false);
        }
      }, 2000); // 2s debounce
      return () => clearTimeout(timer);
    }
  }, [title, grid, rows, cols, categories, wordOrder, user?.id, editingId, isSubmitting, isPublishSuccess, initialData?.is_published]);

  // Auto-claim puzzle if user just logged in and we have a pending publishedId
  useEffect(() => {
    if (publishedId && user && !user.is_anonymous) {
      const claim = async () => {
        const { error } = await updatePuzzle(publishedId, { created_by: user.id });
        if (!error) {
          setPublishedId(null);
          setStatusMsg({ type: 'success', text: "Puzzle successfully claimed and linked to your account!" });
          setTimeout(() => {
            onComplete?.();
          }, 2000);
        }
      };
      claim();
    }
  }, [publishedId, user, onComplete]);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 3 } // Responsive grab
  }));

  const handleCellClick = (r, c) => {
    setEditingCell({ r, c, val: grid[`${r}-${c}`] || '' });
  };

  const saveCell = () => {
    if (!editingCell) return;
    const word = editingCell.val.trim().toUpperCase();
    const newGrid = { ...grid };

    if (word) {
      const parts = word.split(/\s+/);
      const longestWord = Math.max(...parts.map(p => p.length));
      if (longestWord > 12) {
        setEditingCell(prev => ({ ...prev, error: "Individual words cannot exceed 12 letters!" }));
        return;
      }
      if (word.length > 48) {
        setEditingCell(prev => ({ ...prev, error: "Total characters in a tile cannot exceed 48!" }));
        return;
      }

      const exists = Object.entries(grid).find(([k, v]) => v === word && k !== `${editingCell.r}-${editingCell.c}`);
      if (exists) {
        setEditingCell(prev => ({ ...prev, error: "Word already exists in grid!" }));
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
    if (!over) {
      if (active.data.current.type === 'grid') {
        const source = active.data.current;
        const newGrid = { ...grid };
        delete newGrid[`${source.r}-${source.c}`];
        setGrid(newGrid);
      }
      return;
    }

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

  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Auto-clear error messages when user fixes the issue
  useEffect(() => {
    if (statusMsg.type === 'error' && step === 1) {
      const words = Object.values(grid);
      const detected = detectGroups();

      const isWordError = statusMsg.text.includes("3 words");
      const isCatError = statusMsg.text.includes("2 categories");

      if ((isWordError && words.length >= 3) || (isCatError && detected.length >= 2)) {
        setStatusMsg({ type: '', text: '' });
      }
    }
  }, [grid, step, statusMsg.type, statusMsg.text]);

  const goToStep2 = () => {
    const words = Object.values(grid);
    if (words.length < 3) {
      setStatusMsg({ type: 'error', text: "Please add at least 3 words." });
      return;
    }

    const detected = detectGroups();
    if (detected.length < 2) {
      setStatusMsg({ type: 'error', text: "Puzzle must have at least 2 categories (contiguous word groups)." });
      return;
    }

    // Final safety check for character limits
    for (const word of words) {
      const parts = word.split(/\s+/);
      if (parts.some(p => p.length > 12)) {
        setStatusMsg({ type: 'error', text: "One or more words exceed the 12-character limit." });
        return;
      }
      if (word.length > 48) {
        setStatusMsg({ type: 'error', text: "One or more tiles exceed the 48-character limit." });
        return;
      }
    }

    // Smart mapping: preserve descriptions if words are the same or subset
    const newCategories = detected.map(newCat => {
      const sortedNewWords = [...newCat.words].sort().join(',');
      const existing = categories.find(oldCat => {
        const sortedOldWords = [...oldCat.words].sort().join(',');
        // Same words
        if (sortedNewWords === sortedOldWords) return true;
        // Or new words contains all old words
        return oldCat.words.every(w => newCat.words.includes(w));
      });
      return { ...newCat, description: existing?.description || "" };
    });

    setCategories(newCategories);
    setWordOrder([...new Set(words)].sort(() => Math.random() - 0.5));
    setStep(2);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setStatusMsg({ type: '', text: '' });

    const layout = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => grid[`${r}-${c}`] ? 1 : 0)
    );

    const defaultTitle = new Date().toLocaleString([], { 
      month: 'short', day: 'numeric', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });

    const puzzleData = {
      title: title.trim() || defaultTitle,
      categories,
      layout,
      word_order: wordOrder,
      grid_data: grid,
      is_published: true,
      created_by: user?.id || null,
      locale: navigator.language || 'en-US'
    };

    // Validation: Mandatory descriptions and no words from category (len >= 3)
    for (const cat of categories) {
      if (!cat.description.trim()) {
        setStatusMsg({ type: 'error', text: "All category descriptions are mandatory" });
        setIsSubmitting(false);
        return;
      }

      const desc = cat.description.toLowerCase();
      for (const word of cat.words) {
        if (word.length >= 3) {
          const forbidden = word.toLowerCase();
          // Regex for full word match
          const regex = new RegExp(`\\b${forbidden}\\b`, 'i');
          if (regex.test(desc)) {
            setStatusMsg({ 
              type: 'error', 
              text: `Category description cannot contain the word "${word}"` 
            });
            setIsSubmitting(false);
            return;
          }
        }
      }
    }

    const { data, error } = editingId 
      ? await updatePuzzle(editingId, puzzleData)
      : await createPuzzle(puzzleData);

    if (error) {
      setStatusMsg({ type: 'error', text: "Error saving puzzle: " + error.message });
      setIsSubmitting(false);
    } else {
      if (data) setPublishedId(data.id);
      setIsPublishSuccess(true);
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    if (publishedId) {
      // Find the puzzle in the list or just trigger onComplete with the ID
      // The parent App.jsx handlePuzzleComplete usually takes no args or the puzzle object
      // But we want to navigate to the solve page for this specific puzzle.
      // We can pass the ID back and let the parent handle the navigation.
      onComplete?.({ id: publishedId });
    } else {
      onComplete?.();
    }
  };

  const handleGoToAuth = () => {
    const data = { step, title, rows, cols, grid, categories, wordOrder, publishedId };
    onRequireAuth(data);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-50 p-1 sm:p-4">
      <div className="w-full max-w-5xl bg-white sm:rounded-2xl shadow-lg p-1.5 sm:p-5 border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          {step === 2 ? (
            <button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronLeft size={24} />
            </button>
          ) : (
            <div className="w-6" />
          )}
          <h2 className="text-xl font-black uppercase tracking-tight">
            {step === 1 ? 'Design Your Grid' : 'Finalize & Describe'}
          </h2>
          <div className="w-12 flex justify-end">
            {isSaving ? (
              <div className="flex items-center gap-1.5 text-indigo-400">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Saving</span>
              </div>
            ) : lastSavedAt ? (
              <div className="flex items-center gap-1.5 text-slate-300">
                <Check size={10} strokeWidth={4} />
                <span className="text-[8px] font-black uppercase tracking-widest leading-none">Draft Saved</span>
              </div>
            ) : (
              <div className="w-1.5 h-1.5 bg-slate-100 rounded-full" />
            )}
          </div>
        </div>

        {statusMsg.text && (
          <div className={`mb-6 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300 ${statusMsg.type === 'error' ? 'bg-red-50 text-red-700 border-l-4 border-red-500' : 'bg-green-50 text-green-700 border-l-4 border-green-500'
            }`}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wide">{statusMsg.text}</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {statusMsg.showClaim && (
                <button
                  onClick={handleGoToAuth}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                >
                  Sign In to Claim
                </button>
              )}
              <button onClick={() => setStatusMsg({ type: '', text: '' })} className="text-slate-400 hover:text-slate-600 ml-auto">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {isPublishSuccess && (
          <PublishSuccessModal
            isAnonymous={!user || user.is_anonymous}
            onSignIn={() => {
              const data = { step, title, rows, cols, grid, categories, wordOrder, publishedId };
              onRequireAuth({ ...data, mode: 'login' });
            }}
            onSignUp={() => {
              const data = { step, title, rows, cols, grid, categories, wordOrder, publishedId };
              onRequireAuth({ ...data, mode: 'signup' });
            }}
            onClose={handleModalClose}
          />
        )}

        <DndContext sensors={sensors} onDragStart={e => setActiveDrag(e.active.data.current)} onDragEnd={handleDragEnd}>
          {step === 1 ? (
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
                  {/* Visual cues for horizontal scrolling */}
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
                      placeholder="Description"
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
              value={editingCell.val} onChange={e => setEditingCell({ ...editingCell, val: e.target.value, error: '' })}
              onKeyDown={e => e.key === 'Enter' && saveCell()}
            />

            {editingCell.error && (
              <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center mb-4 animate-in fade-in slide-in-from-top-1">
                {editingCell.error}
              </p>
            )}

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
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Save size={32} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Save Your Work</h3>
            <p className="text-slate-500 font-medium mb-8 text-sm leading-relaxed">
              Don't worry, your puzzle hasn't been lost! You just need to sign in or create an account to publish it.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleGoToAuth}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black tracking-widest hover:bg-slate-800 transition-all active:scale-95 uppercase"
              >
                Sign In to Save
              </button>
              <button
                onClick={() => setShowAuthModal(false)}
                className="w-full text-slate-400 font-bold py-2 hover:text-slate-600 transition-colors"
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
