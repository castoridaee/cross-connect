import { Trophy, ThumbsUp, Share2 } from 'lucide-react';

export const SuccessModal = ({ attempts, categories = [] }) => {
  const handleShare = () => {
    const text = `Puzzle solved in ${attempts} attempts.`;
    navigator.share ? navigator.share({ text }) : navigator.clipboard.writeText(text);
  };

  const handleLike = () => {
    // Supabase RPC or insert logic sequence executes here
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full animate-in fade-in zoom-in duration-300">
        <Trophy className="mx-auto text-yellow-500 mb-2" size={48} />
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Solved!</h2>
        <p className="text-slate-500 mt-1 mb-6 text-sm font-bold">Attempts: {attempts}</p>

        <div className="space-y-3 mb-8 text-left max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Categories Revealed</p>
          {categories.map((cat, i) => (
            <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-xs font-black uppercase text-indigo-600 mb-1">{cat.description || 'Contiguous Group'}</p>
              <div className="flex flex-wrap gap-1">
                {cat.words.map(w => (
                  <span key={w} className="text-[9px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 uppercase tracking-tighter">{w}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={handleShare} className="bg-slate-100 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-slate-700 text-xs">
            <Share2 size={16} /> Share
          </button>
          <button onClick={handleLike} className="bg-slate-100 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-slate-700 text-xs">
            <ThumbsUp size={16} /> Like
          </button>
        </div>

        <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 text-xs shadow-xl shadow-slate-200">
          Next Puzzle
        </button>
      </div>
    </div>
  );
};