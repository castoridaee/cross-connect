import React, { useState, useEffect } from 'react';
import { getPuzzlesByAuthor, getProfile } from '../lib/puzzleService';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Edit2, Play, User } from 'lucide-react';
import { generateAnonymousName } from '../utils/nameGenerator';

export default function AuthorProfile({ authorId, currentUser, onEditPuzzle, onBack, onNavigateToPuzzle }) {
  const [profile, setProfile] = useState(null);
  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);

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

      <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100 mb-8 flex items-center gap-6">
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
            <div className="relative z-10">
              <h3 className="text-lg font-black tracking-tight text-slate-900 mb-4">{p.title}</h3>
              <div className="flex gap-2">
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
