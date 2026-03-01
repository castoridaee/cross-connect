import { Trophy, ThumbsUp, Share2 } from 'lucide-react';

export const SuccessModal = ({ attempts }) => {
  const handleShare = () => {
    const text = `Puzzle solved in ${attempts} attempts.`;
    navigator.share ? navigator.share({ text }) : navigator.clipboard.writeText(text);
  };

  const handleLike = () => {
    // Supabase RPC or insert logic sequence executes here
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000]">
      <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-xs w-full">
        <Trophy className="mx-auto text-yellow-500 mb-2" size={48} />
        <h2 className="text-2xl font-bold text-slate-900">Solved</h2>
        <p className="text-slate-500 mt-2 mb-6">Attempts: {attempts}</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={handleShare} className="bg-slate-100 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-slate-700">
            <Share2 size={16} /> Share
          </button>
          <button onClick={handleLike} className="bg-slate-100 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-slate-700">
            <ThumbsUp size={16} /> Like
          </button>
        </div>

        <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">
          Next Puzzle
        </button>
      </div>
    </div>
  );
};