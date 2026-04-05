import { Trophy, Heart, Share2, Check, User, X, MessageSquare, List, Send, Filter, ChevronDown } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { generateShareText, copyToClipboard } from '../utils/shareUtils';
import { useAuth } from '../context/AuthContext';
import { getComments, addComment, toggleCommentLike, getCommentLikes } from '../lib/puzzleService';
import { CommentItem } from './CommentItem';

export const SuccessModal = ({ puzzle, attempts, hintsUsed, categories = [], onAdmire, onNext, onAuthorClick, onShareTrack, onLikeTrack, initialIsLiked = false }) => {
  const { user } = useAuth();
  const [showCopied, setShowCopied] = useState(false);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [activeTab, setActiveTab] = useState('results'); // 'results' or 'comments'
  const scrollRef = useRef(null);
  const modalRef = useRef(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Comments State
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentSort, setCommentSort] = useState('newest'); // 'newest' or 'liked'
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState(new Set());
  const [isSortOpen, setIsSortOpen] = useState(false);

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


  // Track animation state to fully hide elements out of the DOM
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Fetch comments
  useEffect(() => {
    if (activeTab === 'comments' && puzzle?.id) {
      loadComments();
    }
  }, [activeTab, puzzle?.id, commentSort]);

  async function loadComments() {
    setLoadingComments(true);
    try {
      const { data, error } = await getComments(puzzle.id, commentSort);
      if (error) throw error;
      setComments(data || []);

      // If user is logged in, fetch their likes for these comments
      if (user && data?.length > 0) {
        const { data: likes } = await getCommentLikes(user.id, data.map(c => c.id));
        if (likes) {
          setLikedCommentIds(new Set(likes.map(l => l.comment_id)));
        }
      }
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoadingComments(false);
    }
  }

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!user || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await addComment(puzzle.id, user.id, newComment.trim());
      if (error) throw error;

      // Update local state
      setComments(prev => [data, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error("Error posting comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleCommentLike = async (commentId) => {
    if (!user) return; // Only logged in users can like

    // Optimistic UI
    const isCurrentlyLiked = likedCommentIds.has(commentId);
    const newLikedSet = new Set(likedCommentIds);
    if (isCurrentlyLiked) newLikedSet.delete(commentId);
    else newLikedSet.add(commentId);
    setLikedCommentIds(newLikedSet);

    // Update count optimistically
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, likes_count: (c.likes_count || 0) + (isCurrentlyLiked ? -1 : 1) }
        : c
    ));

    try {
      const { error } = await toggleCommentLike(commentId, user.id);
      if (error) throw error;
    } catch (err) {
      // Revert if error
      console.error("Error toggling comment like:", err);
      setLikedCommentIds(likedCommentIds);
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, likes_count: (c.likes_count || 0) + (isCurrentlyLiked ? 1 : -1) }
          : c
      ));
    }
  };

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
        className="bg-white px-4 py-5 sm:px-6 sm:py-6 rounded-3xl shadow-2xl text-center w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-3xl animate-in fade-in zoom-in duration-300 relative h-[95vh] sm:h-[85vh] max-h-[100vh] flex flex-col overflow-hidden"
      >

        {/* Top-left Admire/Close action */}
        <button
          onClick={onAdmire}
          className={`absolute left-3 top-3 sm:left-6 sm:top-6 p-2 text-slate-500 hover:text-slate-700 transition-all active:scale-90 hover:bg-slate-50 rounded-xl z-20 ${activeTab === 'comments' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          title="Close and Admire"
        >
          <X size={22} />
        </button>

        {/* Top-right quick actions */}
        <div className={`absolute right-3 top-3 sm:right-6 sm:top-6 flex gap-1 z-20 transition-all duration-300 ${activeTab === 'comments' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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

        <div className={`flex-shrink-0 grid transition-all duration-500 ease-in-out ${activeTab === 'results' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'} ${activeTab === 'comments' && !isAnimating ? 'hidden' : ''}`}>
          <div className="overflow-hidden">
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-slate-900 leading-none">Solved!</h1>
              <div className="flex justify-center gap-4 mt-1 mb-2">
                <p className="text-slate-500 text-xs sm:text-base font-black uppercase tracking-widest opacity-60">Attempts: {attempts}</p>
                <div className="w-1 h-1 bg-slate-200 rounded-full self-center" />
                <p className="text-slate-500 text-xs sm:text-base font-black uppercase tracking-widest opacity-60">Hints: {hintsUsed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className={`flex-shrink-0 flex justify-center gap-1 mb-2 bg-slate-50 p-0.5 rounded-2xl w-fit mx-auto border border-slate-100/50 h-fit transition-all duration-500 z-30 ${activeTab === 'results' ? 'mt-4' : 'mt-2'}`}>
          <button
            onClick={() => setActiveTab('results')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm sm:text-base font-black uppercase tracking-widest transition-all ${activeTab === 'results' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List size={18} /> Result
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm sm:text-base font-black uppercase tracking-widest transition-all ${activeTab === 'comments' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <MessageSquare size={18} /> Comments
          </button>
        </div>

        {/* Action Panel Section */}
        <div className={`bg-slate-50 border border-slate-100 rounded-2xl p-3 sm:p-5 mb-5 relative text-left overflow-hidden flex-grow flex flex-col min-h-0 min-w-0 transition-all duration-500 ${activeTab === 'comments' ? 'mt-0' : ''}`}>
          {activeTab === 'results' ? (
            <div
              ref={scrollRef}
              className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar scroll-smooth flex-grow min-h-0 h-full animate-in fade-in slide-in-from-left-4 duration-500 fill-mode-both touch-pan-y overscroll-contain"
            >
              {categories.map((cat, i) => (
                <div key={i} className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-100 shadow-sm">
                  <p className="text-sm sm:text-base font-black uppercase text-indigo-600 mb-1">{cat.description || 'Contiguous Group'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.words.map(w => (
                      <span key={w} className="text-xs sm:text-sm font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 text-slate-600 uppercase tracking-tighter leading-none">{w}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both overflow-hidden">
              {/* Comments Header & Sort */}
              <div className="flex justify-between items-center mb-2 px-1 flex-shrink-0">
                <span className="text-sm font-black uppercase tracking-tight text-slate-400">
                  {comments.length} Comments
                </span>

                <div className="relative">
                  <button
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    className="flex items-center gap-1.5 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    <Filter size={12} /> {commentSort === 'newest' ? 'Newest' : 'Top Liked'}
                    <ChevronDown size={12} className={`transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isSortOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-100 rounded-xl shadow-xl z-50 p-1 overflow-hidden border-t-2 border-t-slate-900 animate-in fade-in zoom-in duration-200">
                        <button
                          onClick={() => { setCommentSort('newest'); setIsSortOpen(false); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-widest transition-colors ${commentSort === 'newest' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          Newest First
                        </button>
                        <button
                          onClick={() => { setCommentSort('liked'); setIsSortOpen(false); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-widest transition-colors ${commentSort === 'liked' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          Most Liked
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {loadingComments && comments.length === 0 ? (
                <div className="flex-grow flex items-center justify-center">
                  <div className="animate-pulse font-black text-slate-200 text-base">LOADING...</div>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center py-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm px-4 overflow-hidden">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 flex-shrink-0">
                    <MessageSquare size={32} className="text-slate-300" />
                  </div>
                  <p className="text-base font-black uppercase tracking-widest text-slate-400 mb-1">No comments yet</p>
                </div>
              ) : (
                <div
                  ref={scrollRef}
                  className="flex-grow min-h-0 overflow-y-auto pr-1 custom-scrollbar scroll-smooth touch-pan-y overscroll-contain"
                >
                  {comments.map(c => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      isLiked={likedCommentIds.has(c.id)}
                      onLike={handleToggleCommentLike}
                    />
                  ))}
                </div>
              )}

              {/* Input Area (Fixed inside current flex-grow container) */}
              <div className="mt-4 flex-shrink-0 z-10 pt-2 border-t border-slate-100 bg-slate-50/50 backdrop-blur-[2px]">
                {user ? (
                  <form
                    onSubmit={handlePostComment}
                    className="flex gap-2 items-stretch"
                  >
                    <div className="relative flex-grow">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handlePostComment(e);
                          }
                        }}
                        placeholder="Write a comment..."
                        className="w-full bg-white border border-slate-100 rounded-2xl p-3 text-sm sm:text-base font-bold text-slate-700 resize-none outline-none focus:border-indigo-600 transition-all shadow-inner h-[68px]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newComment.trim() || isSubmitting}
                      className={`aspect-square rounded-xl text-white transition-all active:scale-95 flex items-center justify-center h-[68px] ${newComment.trim() && !isSubmitting ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-200 cursor-not-allowed'
                        }`}
                    >
                      <Send size={20} />
                    </button>
                  </form>
                ) : (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                    <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                      Sign in to join the conversation
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scroll Fade Indicator (only results or if results list scrollable) */}
          {activeTab === 'results' && isScrollable && (
            <div className="absolute bottom-0 left-0 right-1 h-12 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
          )}
        </div>

        <div className={`flex-shrink-0 grid transition-all duration-500 ease-in-out ${activeTab === 'results' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'} ${activeTab === 'comments' && !isAnimating ? 'hidden' : ''}`}>
          <div className="overflow-hidden">
            <div className={`space-y-1.5 sm:space-y-2 pb-0.5 transition-all duration-500 ${activeTab === 'results' ? 'mt-0' : 'mt-4'}`}>
              <button onClick={handleAuthorClick} className="w-full bg-slate-100 text-slate-800 py-3.5 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 text-sm sm:text-base flex items-center justify-center gap-2">
                <User size={18} fill="currentColor" /> More from this Creator
              </button>

              <button onClick={onNext} className="w-full bg-slate-900 text-white py-5 sm:py-6 rounded-2xl sm:rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 text-base sm:text-lg shadow-xl shadow-slate-200">
                Another Puzzle
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};