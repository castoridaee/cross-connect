import React, { useState, useEffect } from 'react';
import { getPuzzlesByAuthor, getProfile, getUserProgressForPuzzles, deletePuzzle, updatePuzzle } from '../lib/puzzleService';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Edit2, Play, User, Share2, Check, SkipForward, Heart, Trash2, EyeOff, MoreVertical, X, BarChart2, Clock, Hash, ChevronDown, Filter } from 'lucide-react';
import { generateAnonymousName } from '../utils/nameGenerator';

function StatTooltip({ label, children }) {
  const [isVisible, setIsVisible] = React.useState(false);
  const timeoutRef = React.useRef(null);

  const handleInteraction = (e) => {
    // Prevent default to avoid virtual mouse events on mobile
    if (e.type === 'touchstart') {
      setIsVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsVisible(false), 2000);
    }
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div 
      className="group relative flex items-center"
      onTouchStart={handleInteraction}
    >
      {children}
      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-xl transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50 ${
        isVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
}

function DeleteDialog({ puzzle, onConfirm, onUnpublish, onEdit, onCancel }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200 relative">
        <button onClick={onCancel} className="absolute right-6 top-6 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={20} />
        </button>
        
        <h3 className="text-xl font-black text-slate-900 mb-2">Manage Puzzle</h3>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          What would you like to do with <span className="font-bold text-slate-900">"{puzzle.title || 'Untitled'}"</span>?
        </p>

        <div className="grid gap-3">
          <button 
            onClick={onEdit}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Edit2 size={16} /> EDIT PUZZLE
          </button>
          
          {puzzle.is_published && (
            <button 
              onClick={onUnpublish}
              className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <EyeOff size={16} /> UN-PUBLISH (MOVE TO DRAFTS)
            </button>
          )}

          <button 
            onClick={onConfirm}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={16} /> DELETE PERMANENTLY
          </button>
          
          <button 
            onClick={onCancel}
            className="w-full border-2 border-slate-100 hover:bg-slate-50 text-slate-400 py-3 rounded-xl font-bold text-sm transition-colors mt-2"
          >
            CANCEL (NO CHANGES)
          </button>
        </div>
      </div>
    </div>
  );
}

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

  const isOwner = currentUser?.id === authorId;

  // Set initial tab to 'manage' if owner
  useEffect(() => {
    if (isOwner) setActiveTab('manage');
  }, [isOwner]);

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
  }, [authorId, currentUser?.id]);

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
        {isOwner && (
          <>
            <button
              onClick={() => setActiveTab('manage')}
              className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${
                activeTab === 'manage' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Manage
              {activeTab === 'manage' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab('unpublished')}
              className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${
                activeTab === 'unpublished' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Unpublished
              {activeTab === 'unpublished' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
            </button>
          </>
        )}
        <button
          onClick={() => setActiveTab('puzzles')}
          className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${
            activeTab === 'puzzles' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Puzzles
          {activeTab === 'puzzles' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('liked')}
          className={`pb-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${
            activeTab === 'liked' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Liked
          {activeTab === 'liked' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
        </button>
      </div>

      {activeTab === 'manage' && (
        <div className="flex justify-end mb-6">
          <div className="relative">
            <button 
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <Filter size={12} className="text-slate-400" />
              Sort: <span className="text-slate-900">{sortBy}</span>
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
                    { id: 'newest', label: 'Newest First' },
                    { id: 'likes', label: 'Most Likes' },
                    { id: 'solves', label: 'Solve Percentage' },
                    { id: 'time', label: 'Fastest Solve' },
                    { id: 'attempts', label: 'Fewest Attempts' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortBy(opt.id);
                        setIsSortOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        sortBy === opt.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
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

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          activeTab === 'manage' ? puzzles.filter(p => p.is_published) :
          activeTab === 'unpublished' ? puzzles.filter(p => !p.is_published) :
          activeTab === 'puzzles' ? puzzles.filter(p => isOwner ? p.is_published : true) :
          likedPuzzles
        ).sort((a, b) => {
          if (sortBy === 'likes') return (b.likes_count || 0) - (a.likes_count || 0);
          if (sortBy === 'solves') {
            const getRate = p => (p.play_count > 0 ? (p.solve_count || 0) / p.play_count : 0);
            return getRate(b) - getRate(a);
          }
          if (sortBy === 'time') {
            const getTime = p => p.median_time_to_solve || 999999;
            return getTime(a) - getTime(b);
          }
          if (sortBy === 'attempts') return (b.median_adjusted_attempts || 0) - (a.median_adjusted_attempts || 0);
          return new Date(b.created_at) - new Date(a.created_at);
        }).map(p => (
          <div key={p.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden flex flex-col">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4 gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">{p.title || 'Untitled'}</h3>
                <div className="flex gap-2 shrink-0">
                  {p.is_published === false && (
                    <div className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                      Draft
                    </div>
                  )}
                  {activeTab !== 'manage' && activeTab !== 'unpublished' ? (
                    <>
                      {likeStatus[p.id] && (
                        <div className="bg-pink-50 text-pink-500 p-1.5 rounded-lg border border-pink-100">
                          <Heart size={14} fill="currentColor" />
                        </div>
                      )}
                      {solveStatus[p.id] === 'solved' && (
                        <div className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                          <Check size={12} strokeWidth={3} /> Solved
                        </div>
                      )}
                      {solveStatus[p.id] === 'skipped' && (
                        <div className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                          <SkipForward size={12} strokeWidth={3} /> Skipped
                        </div>
                      )}
                    </>
                  ) : p.likes_count > 0 && (
                    <StatTooltip label="Community Likes">
                      <div className="bg-pink-50 text-pink-500 px-2 py-1 rounded-lg border border-pink-100 text-[10px] font-black flex items-center gap-1 uppercase tracking-widest">
                        <Heart size={12} fill="currentColor" /> {p.likes_count}
                      </div>
                    </StatTooltip>
                  )}
                </div>
              </div>

              {(activeTab === 'manage' || activeTab === 'unpublished') && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {p.play_count > 0 && (
                    <StatTooltip label={`${Math.round((p.solve_count / p.play_count) * 100)}% Solve Rate`}>
                      <div className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg flex items-center gap-1.5 text-slate-500">
                        <BarChart2 size={12} />
                        <span className="text-[10px] font-bold">{Math.round((p.solve_count / p.play_count) * 100)}% Solves</span>
                      </div>
                    </StatTooltip>
                  )}
                  {p.median_time_to_solve > 0 && (
                    <StatTooltip label="Median Solve Time">
                      <div className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg flex items-center gap-1.5 text-slate-500">
                        <Clock size={12} />
                        <span className="text-[10px] font-bold">
                          {Math.floor(p.median_time_to_solve / 60)}m {Math.round(p.median_time_to_solve % 60)}s
                        </span>
                      </div>
                    </StatTooltip>
                  )}
                  {p.median_adjusted_attempts > 0 && (
                    <StatTooltip label="Median Attempts + Hints">
                      <div className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg flex items-center gap-1.5 text-slate-500">
                        <Hash size={12} />
                        <span className="text-[10px] font-bold">{p.median_adjusted_attempts.toFixed(1)} Attempts</span>
                      </div>
                    </StatTooltip>
                  )}
                </div>
              )}
              <div className="mt-auto flex gap-2">
                {(activeTab === 'manage' || activeTab === 'unpublished') ? (
                  <>
                    <button
                      onClick={() => onEditPuzzle(p)}
                      className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors uppercase"
                    >
                      <Edit2 size={14} /> EDIT
                    </button>
                    <button
                      onClick={() => setDeletingPuzzle(p)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors uppercase"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onNavigateToPuzzle(p)}
                    disabled={p.is_published === false}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                  >
                    {p.is_published === false ? 'DRAFT' : <><Play size={14} fill="currentColor" /> PLAY</>}
                  </button>
                )}
              </div>
            </div>
            {/* Subtle background flair */}
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
          </div>
        ))}
      </div>

      {deletingPuzzle && (
        <DeleteDialog 
          puzzle={deletingPuzzle}
          onConfirm={handleDeleteClick}
          onUnpublish={handleUnpublishClick}
          onEdit={() => { onEditPuzzle(deletingPuzzle); setDeletingPuzzle(null); }}
          onCancel={() => setDeletingPuzzle(null)}
        />
      )}

      {(
        activeTab === 'manage' ? puzzles.filter(p => p.is_published) :
        activeTab === 'unpublished' ? puzzles.filter(p => !p.is_published) :
        activeTab === 'puzzles' ? puzzles.filter(p => isOwner ? p.is_published : true) :
        likedPuzzles
      ).length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <p className="font-bold text-slate-400">
            {activeTab === 'manage' 
              ? "You haven't published any puzzles yet." 
              : activeTab === 'unpublished'
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
