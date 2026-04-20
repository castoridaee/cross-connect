import React, { useState, useEffect } from 'react';
import { getProfile, deletePuzzle, updatePuzzle, getUserMentions, getPaginatedProfilePuzzles, toggleCommentLike, getCommentLikes, markSpecificMentionsRead, markMentionsRead, togglePuzzleLike, getUserUnreadMentionsCount } from '../lib/puzzleService';
import { supabase } from '../lib/supabase';
import { ChevronLeft, User, Share2, Check, ChevronDown, Filter, Settings, MessageSquare, AtSign, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PuzzleCard } from '../components/PuzzleCard';
import { PuzzleOptionsModal } from '../components/PuzzleOptionsModal';
import { ProfileSettingsModal } from '../components/ProfileSettingsModal';
import { CommentItem } from '../components/CommentItem';
import Avatar from "boring-avatars";

export default function AuthorProfile({ authorId, currentUser, onEditPuzzle, onBack, onNavigateToPuzzle, onMentionsRead }) {
  const { signOut, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCopied, setShowCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('puzzles');
  const [deletingPuzzle, setDeletingPuzzle] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Paginated Data State
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingItems, setLoadingItems] = useState(false);

  // Likes/Mentions state (mentions are now items in the list)
  const [likedCommentIds, setLikedCommentIds] = useState(new Set());
  const [authorPuzzleCount, setAuthorPuzzleCount] = useState(0);
  const [authorLikedCount, setAuthorLikedCount] = useState(0);
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [showRightGradient, setShowRightGradient] = useState(true);
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const tabContainerRef = React.useRef(null);

  const isOwner = currentUser?.id === authorId;

  const handleShare = () => {
    const url = window.location.origin + '/a/' + authorId;
    navigator.clipboard.writeText(url);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  // 1. Initial Load: Profile Info
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const profileRes = await getProfile(authorId);
        if (profileRes.data) {
          setProfile(profileRes.data);

          // Get basic counts for the header
          const { count: pCount } = await supabase
            .from('puzzles')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', authorId)
            .eq('is_published', true);
          setAuthorPuzzleCount(pCount || 0);

          const { count: lCount } = await supabase
            .from('user_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', authorId)
            .eq('is_liked', true);
          setAuthorLikedCount(lCount || 0);

          setAuthorLikedCount(lCount || 0);

          // Get global unread mentions count using service
          const { count: mCount } = await getUserUnreadMentionsCount(authorId);
          setGlobalUnreadCount(mCount || 0);
        }
      } catch (err) {
        console.error("Profile load error:", err);
      } finally {
        setLoading(false);
      }
    }
    if (authorId) loadProfile();
  }, [authorId]);

  // 2. Data Fetching & Page Reset Logic
  const prevTabRef = React.useRef(activeTab);
  const prevSortRef = React.useRef(sortBy);

  useEffect(() => {
    let isCancelled = false;

    // Use page 1 if tab or sort just changed
    let fetchPage = currentPage;
    if (prevTabRef.current !== activeTab || prevSortRef.current !== sortBy) {
      prevTabRef.current = activeTab;
      prevSortRef.current = sortBy;
      fetchPage = 1;
      if (currentPage !== 1) {
        setCurrentPage(1);
        // We return here because the currentPage change will trigger the effect again with fetchPage=1
        return;
      }
    }

    async function fetchTabData() {
      setLoadingItems(true);
      try {
        if (activeTab === 'mentions') {
          const res = await getUserMentions(authorId, fetchPage, ITEMS_PER_PAGE);
          if (isCancelled) return;
          setItems(res.data || []);
          setTotalItems(res.count || 0);

          // Fetch likes for these comments
          if (currentUser && res.data?.length > 0) {
            const { data: likes } = await getCommentLikes(currentUser.id, res.data.map(m => m.id));
            if (isCancelled) return;
            if (likes) {
              setLikedCommentIds(new Set(likes.map(l => l.comment_id)));
            }
          }
        } else {
          const typeMap = {
            'puzzles': 'author_published',
            'unpublished': 'author_unpublished',
            'played': 'solved',
            'skipped': 'skipped',
            'in_progress': 'in_progress',
            'liked': 'liked'
          };

          const res = await getPaginatedProfilePuzzles({
            userId: authorId,
            visitorId: currentUser?.id,
            type: typeMap[activeTab],
            page: fetchPage,
            pageSize: ITEMS_PER_PAGE,
            sortBy: sortBy
          });

          if (isCancelled) return;
          if (res.error) throw res.error;
          setItems(res.data || []);
          setTotalItems(res.count || 0);
        }
      } catch (err) {
        if (!isCancelled) console.error("Fetch tab data error:", err);
      } finally {
        if (!isCancelled) setLoadingItems(false);
      }
    }

    if (authorId) {
      fetchTabData();
    }

    return () => { isCancelled = true; };
  }, [authorId, activeTab, currentPage, sortBy, currentUser?.id, ITEMS_PER_PAGE]);

  const handleDeleteClick = async () => {
    if (!deletingPuzzle) return;
    const { error } = await deletePuzzle(deletingPuzzle.id);
    if (!error) {
      setItems(prev => prev.filter(p => p.id !== deletingPuzzle.id));
      setTotalItems(prev => prev - 1);
      setDeletingPuzzle(null);
    }
  };

  const handleUnpublishClick = async () => {
    if (!deletingPuzzle) return;
    const { error } = await updatePuzzle(deletingPuzzle.id, { is_published: false });
    if (!error) {
      if (activeTab === 'puzzles') {
        setItems(prev => prev.filter(p => p.id !== deletingPuzzle.id));
        setTotalItems(prev => prev - 1);
      } else {
        setItems(prev => prev.map(p => p.id === deletingPuzzle.id ? { ...p, is_published: false } : p));
      }
      setDeletingPuzzle(null);
    }
  };

  const handleToggleCommentLike = async (commentId) => {
    if (!currentUser) return;
    const isCurrentlyLiked = likedCommentIds.has(commentId);
    const newLikedSet = new Set(likedCommentIds);
    if (isCurrentlyLiked) newLikedSet.delete(commentId);
    else newLikedSet.add(commentId);
    setLikedCommentIds(newLikedSet);

    // Update in items list
    setItems(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: (c.likes_count || 0) + (isCurrentlyLiked ? -1 : 1) } : c));

    // Handle mention read status
    const targetMention = items.find(m => m.id === commentId);
    if (targetMention && !targetMention.is_read) {
      setItems(prev => prev.map(m => m.id === commentId ? { ...m, is_read: true } : m));
      setGlobalUnreadCount(prev => Math.max(0, prev - 1));
      markSpecificMentionsRead([targetMention.mention_id]).then(() => {
        if (onMentionsRead) onMentionsRead();
      });
    }

    try {
      await toggleCommentLike(commentId, currentUser.id);
    } catch (err) {
      console.error("Error liking comment:", err);
      setLikedCommentIds(likedCommentIds);
    }
  };

  const handleTogglePuzzleLike = async (puzzleId) => {
    if (!currentUser) return;

    const targetPuzzle = items.find(p => p.id === puzzleId);
    if (targetPuzzle && targetPuzzle.created_by === currentUser.id) return;

    const isLiking = !targetPuzzle?.user_progress?.is_liked;

    // Optimistic update
    setItems(prev => prev.map(p => {
      if (p.id === puzzleId) {
        return {
          ...p,
          likes_count: (p.likes_count || 0) + (isLiking ? 1 : -1),
          user_progress: { ...p.user_progress, is_liked: isLiking }
        };
      }
      return p;
    }));

    try {
      const { error } = await togglePuzzleLike(puzzleId, currentUser.id);
      if (error) throw error;
    } catch (err) {
      console.error("Error toggling puzzle like:", err);
      // Revert is complex here, but user can refresh. 
      // Simplified retry logic or just leave optimistic for now as it's likely to succeed.
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadIds = items.filter(m => !m.is_read).map(m => m.mention_id);
      if (unreadIds.length > 0) {
        await markSpecificMentionsRead(unreadIds);
      }
      setItems(prev => prev.map(m => ({ ...m, is_read: true })));
      setGlobalUnreadCount(0);
      if (onMentionsRead) onMentionsRead();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleMentionClick = (mention) => {
    onNavigateToPuzzle(mention.puzzle);
  };

  const handleTabScroll = () => {
    if (!tabContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabContainerRef.current;
    
    // Left gradient: if scrolled more than 10px
    setShowLeftGradient(scrollLeft > 10);
    
    // Right gradient: if not within 10px of end
    setShowRightGradient(scrollLeft + clientWidth < scrollWidth - 10);
  };

  // Initial check for gradient
  useEffect(() => {
    handleTabScroll();
    window.addEventListener('resize', handleTabScroll);
    return () => window.removeEventListener('resize', handleTabScroll);
  }, [authorId, isOwner]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse font-black text-slate-300 text-2xl uppercase tracking-tighter">Loading Profile...</div>
      </div>
    );
  }

  const unreadMentionsCount = activeTab === 'mentions' ? items.filter(m => !m.is_read).length : 0;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <button onClick={onBack} className="mb-8 text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
        <ChevronLeft size={16} /> Back to Game
      </button>

      <div className="mb-12 flex flex-col sm:flex-row items-center sm:justify-between gap-6 sm:gap-8 px-2">
        <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
          <Avatar
            size={80}
            name={authorId}
            variant="beam"
            colors={["#5cacc4", "#8cd19d", "#cee879", "#fcb653", "#ff5254"]}
            square
          />
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 break-all leading-none">
              {profile?.username}
            </h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">
              {authorPuzzleCount} Puzzles Created {isOwner ? '' : `• ${authorLikedCount} Liked`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 sm:mt-0 self-center sm:self-auto w-full sm:w-auto justify-center sm:justify-end flex-wrap">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-3 text-slate-500 hover:text-indigo-600 transition-all active:scale-90 bg-white border border-slate-200 shadow-sm rounded-xl hover:bg-slate-50 hover:border-indigo-100"
            title="Share Profile"
          >
            {showCopied ? <Check size={16} className="text-green-500" /> : <Share2 size={16} />}
            <span className="text-[10px] sm:text-[10px] font-black uppercase tracking-widest break-words">{showCopied ? 'Copied' : 'Share'}</span>
          </button>
          {isOwner && (
            <>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-3 text-slate-500 hover:text-indigo-600 transition-all active:scale-90 bg-white border border-slate-200 shadow-sm rounded-xl hover:bg-slate-50 hover:border-indigo-100"
                title="Profile Settings"
              >
                <Settings size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Settings</span>
              </button>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-3 text-slate-500 hover:text-red-600 transition-all active:scale-90 bg-white border border-slate-200 shadow-sm rounded-xl hover:bg-red-50 hover:border-red-100"
                title="Logout"
              >
                <LogOut size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest break-words">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="relative mb-8 pt-2 overflow-hidden">
          {/* Scroll fade indicators */}
          <div className={`absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showLeftGradient ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showRightGradient ? 'opacity-100' : 'opacity-0'}`} />
          
          <div
            ref={tabContainerRef}
            onScroll={handleTabScroll}
            className="flex gap-4 sm:gap-8 border-b border-slate-100 overflow-x-auto no-scrollbar pb-1"
          >
            <button
              onClick={() => setActiveTab('puzzles')}
              className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'puzzles' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Puzzles
              {activeTab === 'puzzles' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('unpublished')}
              className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'unpublished' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Unpublished
              {activeTab === 'unpublished' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('mentions')}
              className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'mentions' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Mentions
              {globalUnreadCount > 0 && (
                <span className="absolute top-0 -right-2 bg-red-500 w-2 h-2 rounded-full border border-white shadow-sm" />
              )}
              {activeTab === 'mentions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'in_progress' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              In Progress
              {activeTab === 'in_progress' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('liked')}
              className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'liked' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Liked
              {activeTab === 'liked' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('played')}
              className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'played' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Solved
              {activeTab === 'played' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('skipped')}
              className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'skipped' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Skipped
              {activeTab === 'skipped' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
            </button>
          </div>
        </div>
      )}

      {(isOwner || activeTab === 'puzzles') && activeTab !== 'mentions' && (
        <div className="flex justify-end mb-6">
          <div className="relative">
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <Filter size={12} className="text-slate-400" />
              Sort: <span className="text-slate-900">{sortBy.replace('_', ' ')}</span>
              <ChevronDown size={12} className={`text-slate-400 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSortOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSortOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden border-t-4 border-t-slate-900 animate-in fade-in zoom-in duration-200">
                  {[
                    { id: 'unsolved', label: 'Unsolved First' },
                    { id: 'newest', label: 'Newest First' },
                    { id: 'difficulty_desc', label: 'Hardest First' },
                    { id: 'difficulty_asc', label: 'Easiest First' },
                    { id: 'likes', label: 'Most Likes' },
                    { id: 'solves', label: 'Most Solves' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortBy(opt.id);
                        setIsSortOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${sortBy === opt.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className={`flex flex-col gap-6 mb-12 ${loadingItems ? 'min-h-[300px]' : ''}`}>
        {loadingItems ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fetching Data...</p>
          </div>
        ) : activeTab !== 'mentions' ? (
          items.map(p => (
            <PuzzleCard
              key={p.id}
              puzzle={p}
              solveStatus={{ [p.id]: p.user_progress?.status }}
              likeStatus={{ [p.id]: p.user_progress?.is_liked }}
              tab={activeTab}
              currentUser={currentUser}
              onNavigateToPuzzle={onNavigateToPuzzle}
              onEditPuzzle={onEditPuzzle}
              onLike={handleTogglePuzzleLike}
              onActionClick={currentUser && p.created_by === currentUser.id ? () => setDeletingPuzzle(p) : null}
            />
          ))
        ) : (
          <div className="space-y-6">
            {items.some(m => !m.is_read) && (
              <div className="flex justify-end">
                <button
                  onClick={handleMarkAllRead}
                  className="bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2"
                >
                  <Check size={14} strokeWidth={3} /> Mark All Read
                </button>
              </div>
            )}
            {items.map(mention => (
              <div key={mention.id} onClick={() => handleMentionClick(mention)} className="cursor-pointer relative group">
                {!mention.is_read && (
                  <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-white z-10"></div>
                )}
                <CommentItem
                  comment={mention}
                  userId={currentUser?.id}
                  puzzleAuthorId={mention.puzzle?.created_by}
                  onLike={handleToggleCommentLike}
                  isLiked={likedCommentIds.has(mention.id)}
                />
              </div>
            ))}
          </div>
        )}

        {!loadingItems && items.length === 0 && (
          <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <p className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">
              {activeTab === 'unpublished'
                ? "No drafts found."
                : activeTab === 'puzzles'
                  ? "No published puzzles found."
                  : activeTab === 'played'
                    ? "No solved puzzles found."
                    : activeTab === 'skipped'
                      ? "No skipped puzzles found."
                      : activeTab === 'mentions'
                        ? "No mentions found."
                        : activeTab === 'in_progress'
                          ? "No puzzles in progress."
                          : "No liked puzzles found."}
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {(() => {
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        if (totalPages <= 1) return null;

        return (
          <div className="flex items-center justify-center gap-4 mb-12">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loadingItems}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Previous
            </button>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Page <span className="text-slate-900">{currentPage}</span> of {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loadingItems}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Next
            </button>
          </div>
        );
      })()}

      {deletingPuzzle && (
        <PuzzleOptionsModal
          puzzle={deletingPuzzle}
          onDelete={() => handleDeleteClick(deletingPuzzle.id)}
          onUnpublish={() => handleUnpublishClick(deletingPuzzle.id)}
          onAction={(action) => {
            if (action === 'edit') {
              onEditPuzzle(deletingPuzzle);
              setDeletingPuzzle(null);
            }
          }}
          onClose={() => setDeletingPuzzle(null)}
          isDeleting={false}
          isUnpublishing={false}
        />
      )}

      {isSettingsOpen && isOwner && profile && (
        <ProfileSettingsModal
          profile={profile}
          onClose={() => setIsSettingsOpen(false)}
          onUpdated={async (updatedProfile) => {
            setProfile(updatedProfile);
            if (refreshUser) await refreshUser();
          }}
        />
      )}
    </div>
  );
}
