import React, { useState, useEffect } from 'react';
import { getProfile, getUserProgressForPuzzles, deletePuzzle, updatePuzzle, getUserComments, getUserMentions, toggleCommentLike, getCommentLikes } from '../lib/puzzleService';
import { supabase } from '../lib/supabase';
import { ChevronLeft, User, Share2, Check, ChevronDown, Filter, Settings, MessageSquare, AtSign, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { generateAnonymousName } from '../utils/nameGenerator';
import { PuzzleCard } from '../components/PuzzleCard';
import { PuzzleOptionsModal } from '../components/PuzzleOptionsModal';
import { ProfileSettingsModal } from '../components/ProfileSettingsModal';
import { CommentItem } from '../components/CommentItem';
import Avatar from "boring-avatars";

export default function AuthorProfile({ authorId, currentUser, onEditPuzzle, onBack, onNavigateToPuzzle }) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCopied, setShowCopied] = useState(false);
  const [solveStatus, setSolveStatus] = useState({}); // { puzzleId: status }
  const [likeStatus, setLikeStatus] = useState({}); // { puzzleId: boolean }
  const [activeTab, setActiveTab] = useState('puzzles');
  const [likedPuzzles, setLikedPuzzles] = useState([]);
  const [deletingPuzzle, setDeletingPuzzle] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // New Comments/Mentions State
  const [userComments, setUserComments] = useState([]);
  const [userMentions, setUserMentions] = useState([]);
  const [likedCommentIds, setLikedCommentIds] = useState(new Set());
  const [loadingExtras, setLoadingExtras] = useState(false);

  const isOwner = currentUser?.id === authorId;



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

        // Fetch liked puzzles if on that tab (or just always if it's the current user)
        if (currentUser) {
          const { data: likedData } = await supabase
            .from('puzzles')
            .select('*, user_progress!inner(is_liked)')
            .eq('user_progress.user_id', currentUser.id)
            .eq('user_progress.is_liked', true)
            .order('created_at', { ascending: false });
          setLikedPuzzles(likedData || []);

          // Fetch solve status for all visible puzzles
          const allVisibleIds = [...new Set([...authorPuzzles.map(p => p.id), ...(likedData || []).map(p => p.id)])];
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
        isOwner ? getUserMentions(profileData.username || generateAnonymousName(authorId)) : { data: [] }
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
    setUserMentions(prev => prev.map(updater));

    try {
      await toggleCommentLike(commentId, currentUser.id);
    } catch (err) {
      console.error("Error liking comment:", err);
      // Revert if needed
      setLikedCommentIds(likedCommentIds);
    }
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

      <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100 mb-8 flex items-center gap-6 relative">
        <button
          onClick={handleShare}
          className="absolute right-8 top-8 p-3 text-slate-400 hover:text-indigo-600 transition-all active:scale-90 bg-slate-50 rounded-xl hover:bg-slate-100"
          title="Share Profile"
        >
          {showCopied ? <Check size={18} className="text-green-500" /> : <Share2 size={18} />}
        </button>
        {isOwner && (
          <div className="absolute right-20 top-8 flex gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 text-slate-400 hover:text-indigo-600 transition-all active:scale-90 bg-slate-50 rounded-xl hover:bg-indigo-50"
              title="Profile Settings"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={() => signOut()}
              className="p-3 text-slate-400 hover:text-red-600 transition-all active:scale-90 bg-slate-50 rounded-xl hover:bg-red-50"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
        <Avatar
          size={80}
          name={authorId}
          variant="beam"
          colors={["#5cacc4", "#8cd19d", "#cee879", "#fcb653", "#ff5254"]}
          square
        />
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 capitalize">
            {profile?.username || generateAnonymousName(authorId)}
          </h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
            {puzzles.length} Puzzles Created • {likedPuzzles.length} Liked
          </p>
        </div>
      </div>

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
          onClick={() => setActiveTab('liked')}
          className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'liked' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
        >
          Liked
          {activeTab === 'liked' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
        </button>
        {isOwner && (
          <button
            onClick={() => setActiveTab('unpublished')}
            className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'unpublished' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            Unpublished
            {activeTab === 'unpublished' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
          </button>
        )}
        <button
          onClick={() => setActiveTab('comments')}
          className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'comments' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
        >
          Comments
          {activeTab === 'comments' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
        </button>
        {isOwner && (
          <button
            onClick={() => setActiveTab('mentions')}
            className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'mentions' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            Mentions
            {activeTab === 'mentions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
          </button>
        )}
      </div>

      {(activeTab === 'puzzles' || activeTab === 'unpublished') && (
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
        {activeTab === 'comments' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {userComments.length > 0 ? (
              userComments.map(c => (
                <div key={c.id} className="relative group">
                  <div className="absolute -left-3 top-4 bottom-4 w-1 bg-slate-100 rounded-full group-hover:bg-indigo-100 transition-colors" />
                  <div className="mb-1 ml-2">
                     <button 
                        onClick={() => onNavigateToPuzzle(c.puzzle_id)}
                        className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                     >
                       <MessageSquare size={10} /> Puzzle: {c.puzzle?.title || 'Unknown'}
                     </button>
                  </div>
                  <CommentItem 
                    comment={c} 
                    isLiked={likedCommentIds.has(c.id)}
                    onLike={handleToggleCommentLike}
                    userId={currentUser?.id}
                    puzzleAuthorId={c.puzzle?.created_by}
                  />
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <p className="font-bold text-slate-400">No comments found.</p>
              </div>
            )}
          </div>
        ) : activeTab === 'mentions' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             {userMentions.length > 0 ? (
              userMentions.map(c => (
                <div key={c.id} className="relative group">
                  <div className="absolute -left-3 top-4 bottom-4 w-1 bg-indigo-100 rounded-full" />
                  <div className="mb-1 ml-2">
                     <button 
                        onClick={() => onNavigateToPuzzle(c.puzzle_id)}
                        className="text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                     >
                       <AtSign size={10} /> Mentioned in: {c.puzzle?.title || 'Unknown'}
                     </button>
                  </div>
                  <CommentItem 
                    comment={c} 
                    isLiked={likedCommentIds.has(c.id)}
                    onLike={handleToggleCommentLike}
                    userId={currentUser?.id}
                    puzzleAuthorId={c.puzzle?.created_by}
                  />
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <p className="font-bold text-slate-400">No mentions found yet.</p>
              </div>
            )}
          </div>
        ) : (
          (
            activeTab === 'unpublished' ? puzzles.filter(p => !p.is_published) :
              activeTab === 'puzzles' ? puzzles.filter(p => p.is_published) :
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
          }).map(p => (
            <PuzzleCard
              key={p.id}
              puzzle={p}
              solveStatus={solveStatus}
              likeStatus={likeStatus}
              tab={activeTab}
              onNavigateToPuzzle={onNavigateToPuzzle}
              onActionClick={isOwner ? () => setDeletingPuzzle(p) : null}
            />
          ))
        )}
      </div>

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
          onUpdated={(updatedProfile) => setProfile(updatedProfile)}
        />
      )}

      {(
        activeTab === 'unpublished' ? puzzles.filter(p => !p.is_published) :
          activeTab === 'puzzles' ? puzzles.filter(p => p.is_published) :
            activeTab === 'liked' ? likedPuzzles :
            []
      ).length === 0 && activeTab !== 'comments' && activeTab !== 'mentions' && (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <p className="font-bold text-slate-400">
              {activeTab === 'unpublished'
                ? "No drafts found."
                : activeTab === 'puzzles'
                  ? "This user hasn't published any puzzles yet."
                  : "No liked puzzles found."}
            </p>
          </div>
        )}
    </div>
  );
}
