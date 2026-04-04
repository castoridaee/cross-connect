import { Trophy, Heart, Share2, Check, User, X, MessageSquare, List } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { generateShareText, copyToClipboard } from '../utils/shareUtils';

export const SuccessModal = ({ puzzle, attempts, hintsUsed, categories = [], onAdmire, onNext, onAuthorClick, onShareTrack, onLikeTrack, initialIsLiked = false }) => {
  const [showCopied, setShowCopied] = useState(false);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [activeTab, setActiveTab] = useState('results'); // 'results' or 'comments'
  const scrollRef = useRef(null);
  const modalRef = useRef(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const [fixedHeight, setFixedHeight] = useState(null);

  // Sync state if prop changes (e.g. late fetch)
  useEffect(() => {
    setIsLiked(initialIsLiked);
  }, [initialIsLiked]);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, []);

  // Capture height of the results tab to maintain consistency
  useEffect(() => {
    if (activeTab === 'results' && modalRef.current) {
      const updateHeight = () => {
        if (modalRef.current) {
          setFixedHeight(modalRef.current.offsetHeight);
        }
      };
      // Measure immediately
      updateHeight();
      // And measure after animation completes
      const timer = setTimeout(updateHeight, 350);
      return () => clearTimeout(timer);
    }
  }, [activeTab, categories]);

  // Check if categories/comments list needs scroll indicator
  useEffect(() => {
    const checkScrollable = () => {
      if (scrollRef.current) {
        setIsScrollable(scrollRef.current.scrollHeight > scrollRef.current.clientHeight);
      }
    };
    const timer = setTimeout(checkScrollable, 150);
    window.addEventListener('resize', checkScrollable);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScrollable);
    };
  }, [categories, activeTab]);

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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 sm:p-6">
      <div 
        ref={modalRef}
        style={{ 
          height: fixedHeight ? `${fixedHeight}px` : 'auto',
          minHeight: fixedHeight ? `${fixedHeight}px` : 'auto'
        }}
        className="bg-white px-5 py-6 sm:px-10 sm:py-9 rounded-3xl shadow-2xl text-center w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl animate-in fade-in zoom-in duration-300 relative h-full sm:h-auto max-h-[94vh] flex flex-col overflow-hidden"
      >
        
        {/* Top-left Admire/Close action */}
        <button 
          onClick={onAdmire}
          className="absolute left-3 top-3 sm:left-6 sm:top-6 p-2 text-slate-500 hover:text-slate-700 transition-all active:scale-90 hover:bg-slate-50 rounded-xl z-20"
          title="Close and Admire"
        >
          <X size={22} />
        </button>

        {/* Top-right quick actions */}
        <div className="absolute right-3 top-3 sm:right-6 sm:top-6 flex gap-1 z-20">
          <button 
            onClick={handleLike} 
            className={`p-2 rounded-xl transition-all active:scale-90 ${isLiked ? 'text-pink-500 bg-pink-50' : 'text-slate-500 hover:text-pink-500 hover:bg-slate-50'}`}
            title={isLiked ? "Unlike" : "Like"}
          >
            <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
          </button>
          <button 
            onClick={handleShare} 
            className="p-2 text-slate-500 hover:text-indigo-600 transition-all active:scale-90 hover:bg-slate-50 rounded-xl"
            title="Share Result"
          >
            {showCopied ? <Check size={20} className="text-green-500" /> : <Share2 size={20} />}
          </button>
        </div>

        <div className={`flex-shrink-0 grid transition-all duration-500 ease-in-out ${activeTab === 'results' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
          <div className="overflow-hidden">
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <Trophy className="mx-auto text-yellow-500 mb-2 mt-4 sm:mt-0" size={44} />
              <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-slate-900 leading-none">Solved!</h1>
              <div className="flex justify-center gap-4 mt-2 mb-4">
                <p className="text-slate-500 text-[10px] sm:text-sm font-black uppercase tracking-widest opacity-60">Attempts: {attempts}</p>
                <div className="w-1 h-1 bg-slate-200 rounded-full self-center" />
                <p className="text-slate-500 text-[10px] sm:text-sm font-black uppercase tracking-widest opacity-60">Hints: {hintsUsed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className={`flex-shrink-0 flex justify-center gap-2 mb-4 bg-slate-50 p-1 rounded-2xl w-fit mx-auto border border-slate-100/50 h-fit transition-all duration-500 ${activeTab === 'results' ? 'mt-4' : 'mt-8 sm:mt-12'}`}>
          <button
            onClick={() => setActiveTab('results')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'results' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List size={14} /> Result
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'comments' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <MessageSquare size={14} /> Comments
          </button>
        </div>

        {/* Action Panel Section */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 sm:p-5 mb-5 relative text-left overflow-hidden flex-grow flex flex-col min-h-0 min-w-0">
          <div 
            ref={scrollRef} 
            className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar scroll-smooth flex-grow min-h-0 h-full"
          >
            {activeTab === 'results' ? (
              <div className="space-y-2.5 animate-in fade-in slide-in-from-left-4 duration-500 fill-mode-both">
                {categories.map((cat, i) => (
                  <div key={i} className="bg-white p-3 sm:p-4 rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] sm:text-xs font-black uppercase text-indigo-600 mb-1">{cat.description || 'Contiguous Group'}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.words.map(w => (
                        <span key={w} className="text-[9px] sm:text-[10px] font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 text-slate-600 uppercase tracking-tighter leading-none">{w}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm px-4 h-full min-h-[300px] animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 flex-shrink-0">
                  <MessageSquare size={32} className="text-slate-300" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">No comments yet</p>
                <p className="text-xs font-bold text-slate-300 max-w-[240px]">Be the first to share your thoughts on this puzzle!</p>
                
                <div className="mt-10 w-full flex-grow flex flex-col justify-end">
                  <textarea 
                    placeholder="Write a comment..." 
                    disabled 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-400 resize-none outline-none opacity-60 min-h-[80px]"
                  />
                  <button disabled className="mt-3 w-full bg-slate-200 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl shadow-inner cursor-not-allowed">Post Comment</button>
                </div>
              </div>
            )}
          </div>
          
          {/* Scroll Fade Indicator */}
          {isScrollable && (
            <div className="absolute bottom-0 left-0 right-1 h-12 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
          )}
        </div>

        <div className={`flex-shrink-0 grid transition-all duration-500 ease-in-out ${activeTab === 'results' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
          <div className="overflow-hidden">
            <div className="space-y-2.5 sm:space-y-3 pb-1">
              <button onClick={handleAuthorClick} className="w-full bg-slate-100 text-slate-800 py-3.5 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 text-[10px] sm:text-xs flex items-center justify-center gap-2">
                <User size={14} fill="currentColor" /> More from this Creator
              </button>

              <button onClick={onNext} className="w-full bg-slate-900 text-white py-4.5 sm:py-5 rounded-2xl sm:rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 text-xs sm:text-sm shadow-xl shadow-slate-200">
                Another Puzzle
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};