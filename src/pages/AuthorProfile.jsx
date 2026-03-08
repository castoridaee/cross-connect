import React, { useState, useEffect } from 'react';
import { getPuzzlesByAuthor, getProfile, getUserProgressForPuzzles } from '../lib/puzzleService';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Edit2, Play, User, Share2, Check, SkipForward, Heart } from 'lucide-react';
import { generateAnonymousName } from '../utils/nameGenerator';

export default function AuthorProfile({ authorId, currentUser, onEditPuzzle, onBack, onNavigateToPuzzle }) {
  const [profile, setProfile] = useState(null);
  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCopied, setShowCopied] = useState(false);
  const [solveStatus, setSolveStatus] = useState({}); // { puzzleId: status }
  const [likeStatus, setLikeStatus] = useState({}); // { puzzleId: boolean }
  const [activeTab, setActiveTab] = useState('puzzles');
  const [likedPuzzles, setLikedPuzzles] = useState([]);

  const handleShare = () => {
    const url = window.location.origin + '?a=' + authorId;
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
        const puzzlesRes = await getPuzzlesByAuthor(authorId);
        let authorPuzzles = [];
        if (puzzlesRes.data) {
          authorPuzzles = puzzlesRes.data;
        } else {
          const { data: simpleData } = await supabase
            .from('puzzles')
            .select('*')
            .eq('created_by', authorId)
            .order('created_at', { ascending: false });
          authorPuzzles = simpleData || [];
        }
        setPuzzles(authorPuzzles);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse font-black text-slate-300 text-2xl uppercase tracking-tighter">Loading Profile...</div>
      </div>
    );
  }

  const isOwner = currentUser?.id === authorId;

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

      <div className="flex gap-4 mb-8 border-b border-slate-100">
        <button
          onClick={() => setActiveTab('puzzles')}
          className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${
            activeTab === 'puzzles' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Puzzles
          {activeTab === 'puzzles' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('liked')}
          className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${
            activeTab === 'liked' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Liked
          {activeTab === 'liked' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-t-full" />}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(activeTab === 'puzzles' ? puzzles : likedPuzzles).map(p => (
          <div key={p.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4 gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">{p.title}</h3>
                <div className="flex gap-2 shrink-0">
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
                </div>
              </div>
              <div className="mt-auto flex gap-2">
                <button
                  onClick={() => onNavigateToPuzzle(p)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Play size={14} fill="currentColor" /> PLAY
                </button>
                {isOwner && (
                  <button
                    onClick={() => onEditPuzzle(p)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Edit2 size={14} /> EDIT
                  </button>
                )}
              </div>
            </div>
            {/* Subtle background flair */}
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
          </div>
        ))}
      </div>

      {(activeTab === 'puzzles' ? puzzles : likedPuzzles).length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <p className="font-bold text-slate-400">
            {activeTab === 'puzzles' 
              ? "This user hasn't published any puzzles yet." 
              : "No liked puzzles found."}
          </p>
        </div>
      )}
    </div>
  );
}
