import React, { useState, useEffect } from 'react';
import { getPuzzlesByAuthor, getProfile, getUserProgressForPuzzles } from '../lib/puzzleService';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Edit2, Play, User, Share2, Check, SkipForward } from 'lucide-react';
import { generateAnonymousName } from '../utils/nameGenerator';

export default function AuthorProfile({ authorId, currentUser, onEditPuzzle, onBack, onNavigateToPuzzle }) {
  const [profile, setProfile] = useState(null);
  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCopied, setShowCopied] = useState(false);
  const [solveStatus, setSolveStatus] = useState({}); // { puzzleId: status }

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
        const [profileRes, puzzlesRes] = await Promise.all([
          getProfile(authorId),
          getPuzzlesByAuthor(authorId)
        ]);

        if (profileRes.data) setProfile(profileRes.data);
        
        if (puzzlesRes.error) {
           console.warn("Failed to fetch puzzles with join, retrying simple...", puzzlesRes.error);
           // Fallback: Fetch puzzles without the profile join
           const { data: simpleData, error: simpleError } = await supabase
             .from('puzzles')
             .select('*')
             .eq('created_by', authorId)
             .order('created_at', { ascending: false });
           
           if (!simpleError) setPuzzles(simpleData || []);
        } else if (puzzlesRes.data) {
          setPuzzles(puzzlesRes.data);
          
          // Fetch solve status for the current user
          if (currentUser && puzzlesRes.data.length > 0) {
            const puzzleIds = puzzlesRes.data.map(p => p.id);
            const { data: progressData } = await getUserProgressForPuzzles(currentUser.id, puzzleIds);
            if (progressData) {
              const statusMap = {};
              progressData.forEach(p => {
                statusMap[p.puzzle_id] = p.status;
              });
              setSolveStatus(statusMap);
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
  }, [authorId]);

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
             {puzzles.length} Puzzles
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {puzzles.map(p => (
          <div key={p.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4 gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">{p.title}</h3>
                {solveStatus[p.id] === 'solved' && (
                  <div className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
                    <Check size={12} strokeWidth={3} /> Solved
                  </div>
                )}
                {solveStatus[p.id] === 'skipped' && (
                  <div className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
                    <SkipForward size={12} strokeWidth={3} /> Skipped
                  </div>
                )}
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

      {puzzles.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <p className="font-bold text-slate-400">This user hasn't published any puzzles yet.</p>
        </div>
      )}
    </div>
  );
}
