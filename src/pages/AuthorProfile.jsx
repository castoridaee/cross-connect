import React, { useState, useEffect } from 'react';
import { getProfile, getUserProgressForPuzzles, deletePuzzle, updatePuzzle, getUserComments, getUserMentions, toggleCommentLike, getCommentLikes, markSpecificMentionsRead, markMentionsRead, togglePuzzleLike } from '../lib/puzzleService';
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
  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCopied, setShowCopied] = useState(false);
  const [solveStatus, setSolveStatus] = useState({}); // { puzzleId: status }
  const [likeStatus, setLikeStatus] = useState({}); // { puzzleId: boolean }
  const [activeTab, setActiveTab] = useState('puzzles');
  const [likedPuzzles, setLikedPuzzles] = useState([]);
  const [solvedPuzzles, setSolvedPuzzles] = useState([]);
  const [skippedPuzzles, setSkippedPuzzles] = useState([]);
  const [inProgressPuzzles, setInProgressPuzzles] = useState([]);
  const [deletingPuzzle, setDeletingPuzzle] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // New Comments/Mentions State
  const [userComments, setUserComments] = useState([]);
  const [userMentions, setUserMentions] = useState([]);
  const [likedCommentIds, setLikedCommentIds] = useState(new Set());
  const [loadingExtras, setLoadingExtras] = useState(false);

  const isOwner = currentUser?.id === authorId;
  const unreadMentionsCount = userMentions.filter(m => !m.is_read).length;



  const handleShare = () => {
    const url = window.location.origin + '/a/' + authorId;
    navigator.clipboard.writeText(url);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const profileRes = await getProfile(authorId);
        if (profileRes.data) {
          setProfile(profileRes.data);

          // If we have a profile, fetch comments and mentions
          loadExtras(profileRes.data);
        }

        // Fetch author's puzzles
        let puzzlesQuery = supabase
          .from('puzzles')
          .select('*')
          .eq('created_by', authorId);

        // If not the owner, only show published puzzles
        if (currentUser?.id !== authorId) {
          puzzlesQuery = puzzlesQuery.eq('is_published', true);
        }

        const { data: authorPuzzles, error: puzzlesErr } = await puzzlesQuery.order('created_at', { ascending: false });

        if (puzzlesErr) throw puzzlesErr;
        setPuzzles(authorPuzzles || []);

        // Fetch user activities if viewing the profile as an authenticated user
        if (currentUser) {
          const { data: progressPuzzles } = await supabase
            .from('puzzles')
            .select('*, user_progress!inner(status, is_liked, is_skipped, grid_state)')
            .eq('user_progress.user_id', currentUser.id)
            .order('created_at', { ascending: false });

          let solved = [];
          let skipped = [];
          let liked = [];

          if (progressPuzzles) {
            liked = progressPuzzles.filter(p => p.user_progress?.[0]?.is_liked && p.created_by !== currentUser.id);
            solved = progressPuzzles.filter(p => p.user_progress?.[0]?.status === 'solved' && p.created_by !== currentUser.id);
            skipped = progressPuzzles.filter(p => p.user_progress?.[0]?.status === 'skipped' && p.created_by !== currentUser.id);
            // "In progress" = unskipped, unsolved, but has progress (status='started' or just exists)
            // MUST have at least one tile placed
            const inProgress = progressPuzzles.filter(p =>
              p.user_progress?.[0]?.status !== 'solved' &&
              p.user_progress?.[0]?.status !== 'skipped' &&
              !p.user_progress?.[0]?.is_skipped &&
              p.created_by !== currentUser.id &&
              p.user_progress?.[0]?.grid_state &&
              Object.keys(p.user_progress[0].grid_state).length > 0
            );
            setInProgressPuzzles(inProgress);
          }

          setLikedPuzzles(liked);
          setSolvedPuzzles(solved);
          setSkippedPuzzles(skipped);

          // Fetch solve status for all visible puzzles
          const allVisibleIds = [...new Set([...authorPuzzles.map(p => p.id), ...liked.map(p => p.id), ...solved.map(p => p.id), ...skipped.map(p => p.id)])];
          if (allVisibleIds.length > 0) {
            const { data: progressData } = await getUserProgressForPuzzles(currentUser.id, allVisibleIds);
            if (progressData) {
              const statusMap = {};
              const likesMap = {};
              progressData.forEach(p => {
                statusMap[p.puzzle_id] = p.status;
                likesMap[p.puzzle_id] = p.is_liked;
              });
              setSolveStatus(statusMap);
              setLikeStatus(likesMap);
            }
          }
        }
      } catch (err) {
        console.error("Profile load error:", err);
      } finally {
        setLoading(false);
      }
    }
    if (authorId) loadData();
    else setLoading(false);
  }, [authorId, currentUser]);

  // Reset page when tab or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortBy]);

  const handleDeleteClick = async () => {
    if (!deletingPuzzle) return;
    const { error } = await deletePuzzle(deletingPuzzle.id);
    if (!error) {
      setPuzzles(prev => prev.filter(p => p.id !== deletingPuzzle.id));
      setDeletingPuzzle(null);
    }
  };

  const handleUnpublishClick = async () => {
    if (!deletingPuzzle) return;
    const { error } = await updatePuzzle(deletingPuzzle.id, { is_published: false });
    if (!error) {
      setPuzzles(prev => prev.map(p => p.id === deletingPuzzle.id ? { ...p, is_published: false } : p));
      setDeletingPuzzle(null);
    }
  };

  async function loadExtras(profileData) {
    setLoadingExtras(true);
    try {
      const [commentsRes, mentionsRes] = await Promise.all([
        getUserComments(authorId),
        isOwner ? getUserMentions(authorId) : { data: [] }
      ]);

      setUserComments(commentsRes.data || []);
      setUserMentions(mentionsRes.data || []);

      const allCommentIds = [
        ...(commentsRes.data || []).map(c => c.id),
        ...(mentionsRes.data || []).map(c => c.id)
      ];

      if (currentUser && allCommentIds.length > 0) {
        const { data: likes } = await getCommentLikes(currentUser.id, allCommentIds);
        if (likes) {
          setLikedCommentIds(new Set(likes.map(l => l.comment_id)));
        }
      }
    } catch (err) {
      console.error("Error loading profile extras:", err);
    } finally {
      setLoadingExtras(false);
    }
  }

  const handleToggleCommentLike = async (commentId) => {
    if (!currentUser) return;
    const isCurrentlyLiked = likedCommentIds.has(commentId);
    const newLikedSet = new Set(likedCommentIds);
    if (isCurrentlyLiked) newLikedSet.delete(commentId);
    else newLikedSet.add(commentId);
    setLikedCommentIds(newLikedSet);

    // Update in both lists if present
    const updater = c => c.id === commentId ? { ...c, likes_count: (c.likes_count || 0) + (isCurrentlyLiked ? -1 : 1) } : c;
    setUserComments(prev => prev.map(updater));

    // Check if it's an unread mention
    const targetMention = userMentions.find(m => m.id === commentId);
    if (targetMention && !targetMention.is_read) {
      // Mark as read natively
      setUserMentions(prev => prev.map(m => m.id === commentId ? { ...updater(m), is_read: true } : updater(m)));

      // Persist to DB
      markSpecificMentionsRead([targetMention.mention_id]).then(() => {
        if (onMentionsRead) onMentionsRead();
      });
    } else {
      setUserMentions(prev => prev.map(updater));
    }

    try {
      await toggleCommentLike(commentId, currentUser.id);
    } catch (err) {
      console.error("Error liking comment:", err);
      // Revert if needed
      setLikedCommentIds(likedCommentIds);
    }
  };

  const handleTogglePuzzleLike = async (puzzleId) => {
    if (!currentUser) return;
    const isLiking = !likeStatus[puzzleId];

    // Optimistic update
    setLikeStatus(prev => ({ ...prev, [puzzleId]: isLiking }));

    const updateList = (list) => list.map(p =>
      p.id === puzzleId ? { ...p, likes_count: (p.likes_count || 0) + (isLiking ? 1 : -1) } : p
    );

    setSolvedPuzzles(prev => updateList(prev));
    setLikedPuzzles(prev => {
      if (isLiking) {
        const p = solvedPuzzles.find(x => x.id === puzzleId) || puzzles.find(x => x.id === puzzleId);
        return p ? [{ ...p, likes_count: (p.likes_count || 0) + 1 }, ...prev] : prev;
      }
      return prev.filter(x => x.id !== puzzleId);
    });

    try {
      const { error } = await togglePuzzleLike(puzzleId, currentUser.id);
      if (error) throw error;
    } catch (err) {
      console.error("Error toggling puzzle like:", err);
      // Revert optimistic update
      setLikeStatus(prev => ({ ...prev, [puzzleId]: !isLiking }));
    }
  };


  const handleMarkAllRead = async () => {
    try {
      const unreadIds = userMentions.filter(m => !m.is_read).map(m => m.mention_id);
      if (unreadIds.length > 0) {
        await markSpecificMentionsRead(unreadIds);
      }
      setUserMentions(prev => prev.map(m => ({ ...m, is_read: true })));
      if (onMentionsRead) onMentionsRead();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleMentionClick = (mention) => {
    onNavigateToPuzzle(mention.puzzle);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse font-black text-slate-300 text-2xl uppercase tracking-tighter">Loading Profile...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <button onClick={onBack} className="mb-8 text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
        <ChevronLeft size={16} /> Back to Game
      </button>

      <div className="mb-12 flex flex-col sm:flex-row items-center sm:justify-between gap-6 sm:gap-8 px-2 relative">
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
              {puzzles.length} Puzzles Created {isOwner ? '' : `• ${likedPuzzles.length} Liked`}
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
        <div className="flex gap-4 sm:gap-8 mb-8 border-b border-slate-100 overflow-x-auto no-scrollbar">
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
            {unreadMentionsCount > 0 && (
              <span className="absolute top-0 right-0 -mr-2 bg-red-500 w-2 h-2 rounded-full border border-white" />
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

      <div className="grid grid-cols-1 gap-6 mb-12">
        {activeTab !== 'mentions' ? (
          (
            activeTab === 'unpublished' ? puzzles.filter(p => !p.is_published) :
              activeTab === 'puzzles' ? puzzles.filter(p => p.is_published) :
                activeTab === 'played' ? solvedPuzzles :
                  activeTab === 'skipped' ? skippedPuzzles :
                    activeTab === 'in_progress' ? inProgressPuzzles :
                      likedPuzzles
          ).sort((a, b) => {
            if (sortBy === 'unsolved') {
              const solvedA = solveStatus[a.id] === 'solved';
              const solvedB = solveStatus[b.id] === 'solved';
              if (solvedA !== solvedB) {
                return solvedA ? 1 : -1;
              }
              return (b.likes_count || 0) - (a.likes_count || 0);
            }
            if (sortBy === 'likes') return (b.likes_count || 0) - (a.likes_count || 0);
            if (sortBy === 'solves') return (b.solve_count || 0) - (a.solve_count || 0);
            if (sortBy === 'difficulty_desc') return (b.difficulty_score || 0) - (a.difficulty_score || 0);
            if (sortBy === 'difficulty_asc') {
              const scoreA = a.difficulty_score || 999;
              const scoreB = b.difficulty_score || 999;
              return scoreA - scoreB;
            }
            return new Date(b.created_at) - new Date(a.created_at);
          })
            .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
            .map(p => (
              <PuzzleCard
                key={p.id}
                puzzle={p}
                solveStatus={solveStatus}
                likeStatus={likeStatus}
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
            {userMentions.some(m => !m.is_read) && (
              <div className="flex justify-end">
                <button
                  onClick={handleMarkAllRead}
                  className="bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2"
                >
                  <Check size={14} strokeWidth={3} /> Mark All Read
                </button>
              </div>
            )}
            {userMentions
              .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
              .map(mention => (
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
      </div>

      {/* Pagination Controls */}
      {(() => {
        const fullList = activeTab === 'mentions' ? userMentions : (
          activeTab === 'unpublished' ? puzzles.filter(p => !p.is_published) :
            activeTab === 'puzzles' ? puzzles.filter(p => p.is_published) :
              activeTab === 'played' ? solvedPuzzles :
                activeTab === 'skipped' ? skippedPuzzles :
                  activeTab === 'in_progress' ? inProgressPuzzles :
                    likedPuzzles
        );
        const totalItems = fullList.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

        if (totalPages <= 1) return null;

        return (
          <div className="flex items-center justify-center gap-4 mb-12">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Previous
            </button>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Page <span className="text-slate-900">{currentPage}</span> of {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
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
            // Refresh auth user so header updates
            if (refreshUser) await refreshUser();
          }}
        />
      )}

      {(
        activeTab === 'unpublished' ? puzzles.filter(p => !p.is_published) :
          activeTab === 'puzzles' ? puzzles.filter(p => p.is_published) :
            activeTab === 'played' ? solvedPuzzles :
              activeTab === 'skipped' ? skippedPuzzles :
                activeTab === 'liked' ? likedPuzzles :
                  activeTab === 'mentions' ? userMentions :
                    activeTab === 'in_progress' ? inProgressPuzzles :
                      []
      ).length === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <p className="font-bold text-slate-400">
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
  );
}
