import { Trophy, Heart, Share2, Check, User, X, MessageSquare, List, Send, Filter, ChevronDown } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { generateShareText, copyToClipboard } from '../utils/shareUtils';
import { useAuth } from '../context/AuthContext';
import { getComments, addComment, toggleCommentLike, getCommentLikes, getPuzzleUnreadMentions, markSpecificMentionsRead } from '../lib/puzzleService';
import { CommentItem } from './CommentItem';

export const SuccessModal = ({ puzzle, attempts, hintsUsed, categories = [], onAdmire, onNext, onAuthorClick, onShareTrack, onLikeTrack, initialIsLiked = false, onMentionsRead, onAuthRequested }) => {
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
  const [commentSort, setCommentSort] = useState('new'); // 'new' or 'liked' or 'mentions'
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState(new Set());
  const [unreadMentionCommentIds, setUnreadMentionCommentIds] = useState(new Set());
  const [unreadMentionRecordIds, setUnreadMentionRecordIds] = useState(new Set());
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalComments, setTotalComments] = useState(0);
  const COMMENTS_PER_PAGE = 10;

  // Mention Autocomplete Engine
  const mentionMatch = newComment.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
  const isMentioning = mentionMatch !== null;
  const mentionSearch = isMentioning ? mentionMatch[1].toLowerCase() : '';

  const mentionOptions = React.useMemo(() => {
    if (!isMentioning) return [];
    const options = new Set();

    if (puzzle?.author?.username && !puzzle.author.is_anonymous) {
      options.add(puzzle.author.username);
    }

    comments.forEach(c => {
      if (c.author?.username && !c.author.is_anonymous) {
        options.add(c.author.username);
      }
    });

    return Array.from(options)
      .filter(opt => opt.toLowerCase().startsWith(mentionSearch))
      .slice(0, 5);
  }, [isMentioning, mentionSearch, puzzle, comments]);

  const handleSelectMention = (username) => {
    const replacement = newComment.replace(/(?:^|\s)@([a-zA-Z0-9_-]*)$/, ` @${username} `);
    setNewComment(replacement.replace(/^\s+/, ''));

    // Defer focus slightly so React completes render cycle
    setTimeout(() => {
      document.getElementById('comment-input')?.focus();
    }, 10);
  };

  // Fetch Unread Mentions
  useEffect(() => {
    if (user && puzzle?.id) {
      getPuzzleUnreadMentions(user.id, puzzle.id).then(({ data }) => {
        if (data && data.length > 0) {
          setUnreadMentionCommentIds(new Set(data.map(d => d.comment_id)));
          setUnreadMentionRecordIds(new Set(data.map(d => d.id)));
          setCommentSort('mentions');
        }
      });
    }
  }, [user, puzzle?.id]);

  // Mark Mentions Read when entering Comments Tab
  useEffect(() => {
    if (activeTab === 'comments' && unreadMentionRecordIds.size > 0 && user && puzzle?.id) {
      markSpecificMentionsRead(Array.from(unreadMentionRecordIds)).then(() => {
        // We do not clear the local state immediately because we want the UI indicator
        // to persist on the specific comments for the duration of this viewing session
        // so the user knows which ones were new!
        if (onMentionsRead) onMentionsRead();
      });
    }
  }, [activeTab, unreadMentionRecordIds, unreadMentionRecordIds.size, user, puzzle?.id, onMentionsRead]);

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


  // Handle Tab Change with coordinated animation
  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setIsAnimating(true);
    setActiveTab(tab);
    // Sync the animation state reset with the CSS duration (800ms)
    setTimeout(() => setIsAnimating(false), 300);
    if (tab === 'comments' && currentPage !== 1) {
      setCurrentPage(1);
    }
  };

  const loadComments = React.useCallback(async () => {
    setLoadingComments(true);
    try {
      const { data, error, count } = await getComments(
        puzzle.id,
        commentSort,
        currentPage,
        COMMENTS_PER_PAGE,
        user?.user_metadata?.username
      );
      if (error) throw error;
      setTotalComments(count || 0);
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
  }, [puzzle?.id, commentSort, currentPage, user]);

  // Fetch comments
  useEffect(() => {
    if (activeTab === 'comments' && puzzle?.id) {
      loadComments();
    }
  }, [activeTab, puzzle?.id, commentSort, currentPage, loadComments]);

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!user || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await addComment(puzzle.id, user.id, newComment.trim());
      if (error) throw error;

      // Update local state
      setComments(prev => [data, ...prev].slice(0, COMMENTS_PER_PAGE));
      setTotalComments(prev => prev + 1);
      setNewComment('');
      if (currentPage !== 1) setCurrentPage(1);
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
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center p-2 sm:p-6 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div
        ref={modalRef}
        className="w-full max-w-md sm:max-w-3xl bg-white rounded-[1.5rem] shadow-2xl px-2 pt-4 pb-2 sm:px-4 sm:pt-5 sm:pb-4 text-center flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-300 h-full max-h-[96dvh] sm:max-h-[90dvh]"
      >

        {/* Top-left Admire/Close action */}
        <button
          onClick={onAdmire}
          className="absolute left-2 top-2 sm:left-3 sm:top-3 p-2 text-slate-500 hover:text-slate-700 transition-all active:scale-90 hover:bg-slate-100 rounded-xl z-20"
          title="Close and Admire"
        >
          <X size={24} strokeWidth={2.5} />
        </button>

        {/* Top-right quick actions */}
        <div className={`absolute right-2 top-2 sm:right-3 sm:top-3 flex gap-1 z-20 transition-all duration-300 ${activeTab === 'comments' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {user?.id !== puzzle.created_by && (
            <button
              onClick={handleLike}
              className={`p-2 rounded-xl transition-all active:scale-90 ${isLiked ? 'text-pink-500 bg-pink-50' : 'text-slate-500 hover:text-pink-600 hover:bg-slate-100'}`}
              title={isLiked ? "Unlike" : "Like"}
            >
              <Heart size={24} fill={isLiked ? "currentColor" : "none"} strokeWidth={2.5} />
            </button>
          )}
          <button
            onClick={handleShare}
            className="p-2 text-slate-500 hover:text-indigo-600 transition-all active:scale-90 hover:bg-slate-100 rounded-xl"
            title="Share Result"
          >
            {showCopied ? <Check size={24} className="text-green-500" strokeWidth={2.5} /> : <Share2 size={24} strokeWidth={2.5} />}
          </button>
        </div>

        <div className={`flex-shrink-0 grid transition-all duration-300 ease-in-out ${activeTab === 'results' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'} ${activeTab === 'comments' && !isAnimating ? '' : ''}`}>
          <div className="overflow-hidden">
            <div className="animate-in fade-in slide-in-from-top-4 duration-300 mt-1 sm:mt-0">
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-slate-900 leading-none">Solved</h1>
              <div className="flex justify-center gap-2 sm:gap-3 mt-1 sm:mt-1.5 mb-2 sm:mb-3">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest opacity-60">Attempts: {attempts}</p>
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full self-center" />
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest opacity-60">Hints: {hintsUsed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className={`flex-shrink-0 flex justify-center gap-6 sm:gap-8 mb-4 sm:mb-6 w-fit mx-auto h-fit transition-all duration-300 z-30 ${activeTab === 'results' ? 'mt-1 sm:mt-2' : 'mt-0.5 sm:mt-1'}`}>
          <button
            onClick={() => handleTabChange('results')}
            className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors py-1 ${activeTab === 'results' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Result
          </button>
          <button
            onClick={() => handleTabChange('comments')}
            className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors py-1 relative ${activeTab === 'comments' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Comments
            {unreadMentionCommentIds.size > 0 && (
              <span className="absolute top-0 right-0 -mr-3 -mt-1 bg-red-500 w-2 h-2 rounded-full border border-white" />
            )}
          </button>
        </div>

        {/* Action Panel Section */}
        <div className={`bg-slate-100 border border-slate-200 rounded-2xl sm:rounded-[1.25rem] p-3 sm:p-4 relative text-left overflow-hidden flex-grow flex flex-col min-h-0 min-w-0 transition-all duration-300 ${activeTab === 'comments' ? 'mt-0 mb-0' : 'mb-2 sm:mb-3'}`}>
          {activeTab === 'results' ? (
            <div className="relative flex-grow min-h-0 flex flex-col">
              <div
                ref={scrollRef}
                className="space-y-3 sm:space-y-3 overflow-y-auto pr-1 custom-scrollbar scroll-smooth flex-grow min-h-0 h-full animate-in fade-in slide-in-from-left-4 duration-300 fill-mode-both touch-pan-y overscroll-contain"
              >
                {categories.map((cat, i) => (
                  <div key={i} className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-lg sm:text-xl font-black text-indigo-600 mb-1.5 sm:mb-2 tracking-tight">{cat.description || 'Contiguous Group'}</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {cat.words.map(w => (
                        <span key={w} className="text-sm sm:text-base font-semibold bg-slate-100 px-3 py-1 sm:px-4 sm:py-1.5 rounded-md sm:rounded-lg border border-slate-200 text-slate-700 uppercase tracking-tighter leading-tight opacity-90">{w}</span>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Dummy pad to ensure last item clears the gradient */}
                <div className="h-12 flex-shrink-0" />
              </div>
              {isScrollable && (
                <div className="absolute bottom-0 left-0 right-1 h-16 sm:h-24 bg-gradient-to-t from-slate-100 via-slate-100/80 to-transparent pointer-events-none z-10" />
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both overflow-hidden">
              {/* Comments Header & Sort */}
              <div className="flex justify-between items-center mb-6 sm:mb-6 px-2 flex-shrink-0">
                <span className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-500">
                  {totalComments} Comments
                </span>

                <div className="relative">
                  <button
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    className="flex items-center gap-2 p-2 sm:p-2 text-base sm:text-base font-black uppercase tracking-widest text-slate-600 hover:text-slate-900 transition-colors bg-white rounded-xl shadow-sm border border-slate-200"
                  >
                    <Filter size={12} className="w-4 h-4" /> {commentSort === 'new' ? 'New' : commentSort === 'mentions' ? 'Mentions' : 'Liked'}
                    <ChevronDown size={12} className={`w-4 h-4 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isSortOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-56 sm:w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden border-t-2 border-t-slate-900 animate-in fade-in zoom-in duration-200">
                        <button
                          onClick={() => { setCommentSort('new'); setCurrentPage(1); setIsSortOpen(false); }}
                          className={`w-full text-left px-5 py-4 sm:px-6 sm:py-5 rounded-xl text-base sm:text-lg font-bold uppercase tracking-widest transition-colors ${commentSort === 'new' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'}`}
                        >
                          New
                        </button>
                        <button
                          onClick={() => { setCommentSort('liked'); setCurrentPage(1); setIsSortOpen(false); }}
                          className={`w-full text-left px-5 py-4 sm:px-6 sm:py-5 rounded-xl text-base sm:text-lg font-bold uppercase tracking-widest transition-colors ${commentSort === 'liked' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'}`}
                        >
                          Liked
                        </button>
                        <button
                          onClick={() => { setCommentSort('mentions'); setCurrentPage(1); setIsSortOpen(false); }}
                          className={`w-full text-left px-5 py-4 sm:px-6 sm:py-5 rounded-xl text-base sm:text-lg font-bold uppercase tracking-widest transition-colors flex items-center justify-between ${commentSort === 'mentions' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'}`}
                        >
                          Mentions
                          {unreadMentionCommentIds.size > 0 && (
                            <span className="bg-red-500 w-2 h-2 rounded-full border border-white" />
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {loadingComments && comments.length === 0 ? (
                <div className="flex-grow flex items-center justify-center">
                  <div className="animate-pulse font-black text-slate-300 text-2xl sm:text-3xl tracking-widest">LOADING...</div>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center py-16 sm:py-24 text-center bg-white rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm px-6 overflow-hidden">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 bg-slate-100 rounded-full flex items-center justify-center mb-6 sm:mb-8 flex-shrink-0">
                    <MessageSquare className="text-slate-400 w-12 h-12 sm:w-14 sm:h-14" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-slate-500 mb-2">No comments yet</p>
                </div>
              ) : (
                <div className="relative flex-grow min-h-0">
                  <div
                    ref={scrollRef}
                    className="h-full overflow-y-auto pr-1 custom-scrollbar scroll-smooth touch-pan-y overscroll-contain"
                  >
                    {comments.map(c => (
                      <div key={c.id} className="relative">
                        {unreadMentionCommentIds.has(c.id) && (
                          <div className="absolute top-2 right-2 sm:top-2 sm:right-2 flex items-center justify-center p-1 bg-red-500 rounded-full border border-white z-10 w-3 h-3"></div>
                        )}
                        <CommentItem
                          comment={c}
                          isLiked={likedCommentIds.has(c.id)}
                          onLike={handleToggleCommentLike}
                          userId={user?.id}
                          puzzleAuthorId={puzzle.created_by}
                        />
                      </div>
                    ))}

                    {/* Pagination Controls */}
                    {totalComments > COMMENTS_PER_PAGE && (
                      <div className="flex items-center justify-between gap-4 py-6 px-2 flex-shrink-0">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1 || loadingComments}
                          className="flex-1 bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                        >
                          Previous
                        </button>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                          {currentPage} / {Math.ceil(totalComments / COMMENTS_PER_PAGE)}
                        </div>
                        <button
                          onClick={() => setCurrentPage(p => p + 1)}
                          disabled={currentPage >= Math.ceil(totalComments / COMMENTS_PER_PAGE) || loadingComments}
                          className="flex-1 bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                        >
                          Next
                        </button>
                      </div>
                    )}

                    {/* Dummy pad to ensure last item clears the gradient */}
                    <div className="h-12 flex-shrink-0" />
                  </div>
                  {isScrollable && (
                    <div className="absolute bottom-0 left-0 right-1 h-16 sm:h-24 bg-gradient-to-t from-slate-100 via-slate-100/80 to-transparent pointer-events-none z-10" />
                  )}
                </div>
              )}

              {/* Input Area (Fixed inside current flex-grow container) */}
              <div className="mt-4 flex-shrink-0 z-10 pt-2 border-t border-slate-200 bg-slate-100/50 backdrop-blur-[2px]">
                {(user && !user.is_anonymous) ? (
                  (
                    <form
                      onSubmit={handlePostComment}
                      className="flex gap-2 items-stretch"
                    >
                      <div className="relative flex-grow">
                        {isMentioning && mentionOptions.length > 0 && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 w-full sm:w-auto min-w-[200px] bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Mention a User
                            </div>
                            <div className="max-h-[160px] overflow-y-auto no-scrollbar pointer-events-auto">
                              {mentionOptions.map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleSelectMention(opt)}
                                  className="w-full text-left px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-900 hover:text-white transition-colors border-b border-slate-50 last:border-0"
                                >
                                  @{opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <input
                          id="comment-input"
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          maxLength={1000}
                          autoComplete="off"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              // Stop submission if autocomplete is active but let them resolve it via click for now
                              // Or simply allow posting if they actually hit enter
                              if (isMentioning && mentionOptions.length > 0) {
                                handleSelectMention(mentionOptions[0]);
                              } else {
                                handlePostComment(e);
                              }
                            }
                          }}
                          placeholder="Write a comment..."
                          className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl px-4 sm:px-5 text-base sm:text-lg font-normal text-slate-800 outline-none focus:border-indigo-600 transition-all shadow-inner h-[48px] sm:h-[56px]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!newComment.trim() || isSubmitting}
                        className={`aspect-square rounded-lg sm:rounded-xl text-white transition-all active:scale-95 flex items-center justify-center h-[48px] sm:h-[56px] ${newComment.trim() && !isSubmitting ? 'bg-indigo-600 shadow-xl shadow-indigo-200' : 'bg-slate-200 cursor-not-allowed'
                          }`}
                      >
                        <Send className="w-5 h-5 sm:w-6 sm:h-6" />
                      </button>
                    </form>
                  )
                ) : (
                  <div className="bg-slate-100 border border-slate-200 rounded-[1.25rem] p-6 sm:p-8 text-center flex flex-col items-center gap-3">
                    <p className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-500">
                      Sign in to add a comment
                    </p>
                    <button
                      onClick={onAuthRequested}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-colors active:scale-95 shadow-md"
                    >
                      Sign In / Sign Up
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={`flex-shrink-0 grid transition-all duration-300 ease-in-out ${activeTab === 'results' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'} ${activeTab === 'comments' && !isAnimating ? '' : ''}`}>
          <div className="overflow-hidden">
            <div className={`space-y-2 sm:space-y-3 pb-0 transition-all duration-300 ${activeTab === 'results' ? 'mt-0' : 'mt-2'}`}>
              <button onClick={handleAuthorClick} className="w-full bg-slate-200 text-slate-900 py-3.5 sm:py-3.5 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-300 transition-all active:scale-95 text-lg sm:text-sm flex items-center justify-center gap-2">
                <User className="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor" /> More from this Creator
              </button>

              <button onClick={onNext} className="w-full bg-slate-900 text-white py-4 sm:py-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 text-xl sm:text-base shadow-lg shadow-slate-200">
                Another Puzzle
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};