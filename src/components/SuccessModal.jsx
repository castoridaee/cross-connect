import { Trophy, ThumbsUp, Share2, Check, User } from 'lucide-react';
import React, { useState } from 'react';
import { generateShareText, copyToClipboard } from '../utils/shareUtils';

export const SuccessModal = ({ puzzle, attempts, hintsUsed, categories = [], onAdmire, onNext, onAuthorClick, onShareTrack, onLikeTrack, initialIsLiked = false }) => {
  const [showCopied, setShowCopied] = useState(false);
  const [isLiked, setIsLiked] = useState(initialIsLiked);

  // Sync state if prop changes (e.g. late fetch)
  React.useEffect(() => {
    setIsLiked(initialIsLiked);
  }, [initialIsLiked]);

  // Lock body scroll when modal is open
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, []);

  const handleShare = () => {
    const text = generateShareText(puzzle, { attempts, hintsUsed });
    copyToClipboard(text, () => {
      setShowCopied(true);
      if (onShareTrack) onShareTrack();
      setTimeout(() => setShowCopied(false), 2000);
    });
  };

  const handleAuthorClick = () => {
    if (onAuthorClick) onAuthorClick();
  };

  const handleLike = () => {
    // Optimistic toggle
    const newState = !isLiked;
    setIsLiked(newState);
    if (onLikeTrack) onLikeTrack(newState);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full animate-in fade-in zoom-in duration-300">
        <Trophy className="mx-auto text-yellow-500 mb-2" size={48} />
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Solved!</h2>
        <div className="flex justify-center gap-4 mt-1 mb-6">
          <p className="text-slate-500 text-sm font-bold">Attempts: {attempts}</p>
          <p className="text-slate-500 text-sm font-bold">Hints: {hintsUsed}</p>
        </div>

        <button onClick={onAdmire} className="w-full bg-indigo-50 text-indigo-600 border border-indigo-100 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95 text-[10px] mb-6 shadow-sm">
          Admire Puzzle
        </button>

        <div className="relative mb-8">
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Categories Revealed</p>
            {categories.map((cat, i) => (
              <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-xs font-black uppercase text-indigo-600 mb-1">{cat.description || 'Contiguous Group'}</p>
                <div className="flex flex-wrap gap-1">
                  {cat.words.map(w => (
                    <span key={w} className="text-[9px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 uppercase tracking-tighter">{w}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Subtle fade indicator for scrolling */}
          <div className="absolute bottom-0 left-0 right-2 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={handleShare} className="bg-slate-100 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-slate-700 text-xs transition-colors">
            {showCopied ? (
              <><Check size={16} className="text-green-500" /> Copied</>
            ) : (
              <><Share2 size={16} /> Share</>
            )}
          </button>
          <button 
            onClick={handleLike} 
            className={`p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all active:scale-95 ${
              isLiked 
                ? 'bg-pink-50 text-pink-600 border border-pink-100' 
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            <ThumbsUp size={16} fill={isLiked ? "currentColor" : "none"} /> 
            {isLiked ? 'Liked!' : 'Like'}
          </button>
        </div>

        <button onClick={handleAuthorClick} className="w-full bg-slate-100 text-slate-800 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 text-[10px] mb-2 flex items-center justify-center gap-2">
          <User size={14} fill="currentColor" /> More from this Creator
        </button>

        <button onClick={onNext} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 text-xs shadow-xl shadow-slate-200">
          Another Puzzle
        </button>
      </div>
    </div>
  );
};