import React, { useState } from 'react';
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { usePuzzleGame } from '../hooks/usePuzzleGame';
import { WordTile } from '../components/WordTile';
import { recordPuzzleEngagement, togglePuzzleLike, getPuzzleProgress } from '../lib/puzzleService';
import { GridDroppable } from '../components/GridDroppable';
import { DraggableTile } from '../components/DraggableTile';
import { WordBank } from '../components/WordBank';
import { SuccessModal } from '../components/SuccessModal';
import { Plus, Share2, Check, SkipForward } from 'lucide-react';
import { generateAnonymousName } from '../utils/nameGenerator';
import { generateShareText, copyToClipboard } from '../utils/shareUtils';
import Avatar from "boring-avatars";

export default function PuzzleSolver({ puzzle, user, onNavigateToCreate, onAuthorClick, onSkip, initialProgress, onNext }) {
  const { grid, history, hints, state, isFlashing, isLiked, handleMove, onCheck, onHint, onReset, onToggleLike } = usePuzzleGame(puzzle, user, initialProgress);
  const [activeId, setActiveId] = useState(null);
  const [showCopied, setShowCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [tapHint, setTapHint] = useState({ show: false, x: 0, y: 0 });
  const hintTimeoutRef = React.useRef(null);

  // Show success modal when puzzle is solved
  React.useEffect(() => {
    if (state.solved) {
      setShowSuccess(true);
    }
  }, [state.solved]);

  // Robust Safety Net: Ensure play is recorded whenever we have a user and puzzle
  React.useEffect(() => {
    if (user && puzzle) {
      console.log(`[PuzzleSolver] Safety Net: Recording play for ${puzzle.id}...`);
      import('../lib/puzzleService').then(m => m.recordPuzzlePlay(user.id, puzzle.id));
    }
  }, [user?.id, puzzle?.id]);

  const handleShare = () => {
    const text = generateShareText(puzzle);
    copyToClipboard(text, () => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

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

  const handleGridClick = (e, msg) => {
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);

    // Protection against edge spills
    const x = Math.max(100, Math.min(window.innerWidth - 100, e.clientX));

    setTapHint({ show: true, x, y: e.clientY, text: msg });

    hintTimeoutRef.current = setTimeout(() => {
      setTapHint(prev => ({ ...prev, show: false }));
    }, 2000);
  };

  return (
    <DndContext sensors={sensors} onDragStart={e => setActiveId(e.active.id)} onDragEnd={handleDragEnd}>
      <div className="flex flex-col items-center min-h-screen bg-slate-50 px-2 pb-6 pt-0 relative touch-pan-y">
        {/* Puzzle Metadata Header */}
        <div className="w-full max-w-md mb-6 text-center relative select-none">
          <div className="flex justify-end gap-3 mb-2">
            <button
              onClick={onSkip}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-all active:scale-90"
              title={state.solved ? "Next Puzzle" : "Skip Puzzle"}
            >
              <SkipForward size={18} />
            </button>
            <button
              onClick={handleShare}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-all active:scale-90"
              title="Share Puzzle"
            >
              {showCopied ? <Check size={18} className="text-green-500" /> : <Share2 size={18} />}
            </button>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-1">
            {puzzle.title || 'Untitled Puzzle'}
          </h1>

          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">By</span>
            {puzzle.created_by && (
              <Avatar
                size={20}
                name={puzzle.created_by}
                variant="beam"
                colors={["#5cacc4", "#8cd19d", "#cee879", "#fcb653", "#ff5254"]}
                square
              />
            )}
            {puzzle.created_by ? (
              <button
                onClick={() => onAuthorClick(puzzle.created_by)}
                className="text-indigo-600 hover:text-indigo-800 font-bold transition-colors underline decoration-2 underline-offset-4"
              >
                {puzzle.author?.username || generateAnonymousName(puzzle.created_by)}
              </button>
            ) : (
              <span className="text-slate-900 font-bold">{generateAnonymousName(puzzle.id)}</span>
            )}
          </div>
        </div>
        <div className="w-full relative px-0 mb-4">
          {/* Visual cues for horizontal scrolling */}
          <div className="absolute left-0 top-0 bottom-6 w-8 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none opacity-50" />
          <div className="absolute right-0 top-0 bottom-6 w-8 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none opacity-50" />

          <div className="overflow-x-auto pb-6 custom-scrollbar text-center select-none">
            <div className="inline-block min-w-max mx-auto">
              <section className="grid gap-0 border-t-2 border-l-2 border-black">
                {puzzle.layout.map((row, r) => (
                  <div key={r} className="flex gap-0 justify-center">
                    {row.map((active, c) => (
                      <div
                        key={`${r}-${c}`}
                        className={`w-16 h-16 border-r-2 border-b-2 border-black overflow-hidden ${!active ? 'bg-slate-900' : ''}`}
                        onClick={active
                          ? (!grid[`${r}-${c}`] ? (e) => handleGridClick(e, "Grab words below\nAnd drag them into this grid") : undefined)
                          : (e) => handleGridClick(e, "Grab words below\nAnd drag them into the open squares in this grid")
                        }
                      >
                        {active && (
                          <GridDroppable
                            id={`cell-${r}-${c}`}
                            word={grid[`${r}-${c}`]}
                            isError={state.errors.includes(`${r}-${c}`)}
                            activeDrag={activeId === grid[`${r}-${c}`]}
                            isFlashing={isFlashing && !grid[`${r}-${c}`]}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            </div>
          </div>
        </div>

        <div className="select-none w-full flex flex-col items-center">
          <WordBank>
            {bankWords.map(w => <DraggableTile key={w} id={w} label={w} />)}
          </WordBank>
        </div>

        <div className="w-full max-w-xs flex flex-col gap-3 mb-8">
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={state.solved || hints.length >= puzzle.categories.length * 2}
              onClick={onHint}
              className="bg-slate-200 text-slate-700 py-4 rounded-2xl font-black tracking-widest transition-all active:scale-95 disabled:opacity-30 disabled:grayscale uppercase text-xs flex items-center justify-center gap-2"
            >
              Hint
              {hints.length > 0 && ` (${hints.length}/${puzzle.categories.length * 2})`}
            </button>
            <button
              onClick={state.solved ? () => setShowSuccess(true) : onCheck}
              className="bg-slate-900 text-white py-4 rounded-2xl font-black tracking-widest transition-all active:scale-95 active:bg-slate-700 select-none uppercase text-xs"
            >
              {state.solved ? 'VIEW RESULTS' : isGridFull ? 'SUBMIT' : 'CHECK'}
            </button>
          </div>
        </div>

        <section className="w-full max-w-md flex flex-col gap-3">
          {hints.length > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-50 border-l-4 border-indigo-500 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block mb-2">Hints Revealed</span>
              <div className="space-y-2">
                {puzzle.categories.map((cat, idx) => {
                  const level1 = hints.some(h => h.index === idx && h.level === 1);
                  const level2 = hints.some(h => h.index === idx && h.level === 2);
                  if (!level1) return null;

                  return (
                    <div key={idx} className="text-xs font-bold text-indigo-900">
                      • {cat.description || 'Category'}
                      {level2 && <span className="text-[10px] text-indigo-400 ml-1.5 uppercase tracking-tighter">({cat.words.length} words)</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {history.map((entry) => (
            <div key={entry.attempt} className="p-3 border-l-4 shadow-sm border-red-500 bg-red-50 text-red-900 animate-in fade-in duration-200">
              <span className="text-[10px] font-black uppercase block mb-1">Attempt {entry.attempt} Notes</span>
              {entry.messages.map((msg, i) => (
                <div key={i} className="text-xs">{msg}</div>
              ))}
            </div>
          ))}
        </section>

        <DragOverlay>
          {activeId && (
            <div className="opacity-80 scale-105 rotate-2 shadow-2xl">
              <WordTile label={activeId} variant="active" />
            </div>
          )}
        </DragOverlay>

        {showSuccess && (
          <SuccessModal
            puzzle={puzzle}
            attempts={state.attempts}
            hintsUsed={hints.length}
            categories={puzzle.categories}
            onAdmire={() => setShowSuccess(false)}
            onNext={onNext}
            onAuthorClick={() => {
              if (user) recordPuzzleEngagement(puzzle.id, user.id, 'profile_click');
              onAuthorClick(puzzle.created_by);
            }}
            onShareTrack={() => {
              if (user) recordPuzzleEngagement(puzzle.id, user.id, 'share');
            }}
            onLikeTrack={onToggleLike}
            initialIsLiked={isLiked}
          />
        )}

        {/* Floating Tap Hint Tip */}
        {tapHint.show && (
          <div
            className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-[calc(100%+20px)] animate-in fade-in zoom-in duration-300"
            style={{ left: tapHint.x, top: tapHint.y }}
          >
            <div className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-2xl shadow-2xl relative whitespace-pre-wrap w-max max-w-[180px] text-center">
              {tapHint.text}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-slate-900 rotate-45" />
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
