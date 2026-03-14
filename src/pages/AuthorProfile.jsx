import React, { useState, useEffect } from 'react';
import { getProfile, getUserProgressForPuzzles, deletePuzzle, updatePuzzle } from '../lib/puzzleService';
import { supabase } from '../lib/supabase';
import { ChevronLeft, User, Share2, Check, ChevronDown, Filter, Settings } from 'lucide-react';
import { generateAnonymousName } from '../utils/nameGenerator';
import { PuzzleCard } from '../components/PuzzleCard';
import { PuzzleOptionsModal } from '../components/PuzzleOptionsModal';
import { ProfileSettingsModal } from '../components/ProfileSettingsModal';

export default function AuthorProfile({ authorId, currentUser, onEditPuzzle, onBack, onNavigateToPuzzle }) {
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
        if (profileRes.data) setProfile(profileRes.data);

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
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="absolute right-20 top-8 p-3 text-slate-400 hover:text-indigo-600 transition-all active:scale-90 bg-slate-50 rounded-xl hover:bg-slate-100"
            title="Profile Settings"
          >
            <Settings size={18} />
          </button>
        )}
        <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
          <User size={40} />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 capitalize">
            {profile?.nickname || generateAnonymousName(authorId)}
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
        {(
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
        ))}
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
            likedPuzzles
      ).length === 0 && (
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
