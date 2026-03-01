import { Trophy } from 'lucide-react';

export const SuccessModal = ({ attempts }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000]">
      <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-xs w-full">
        <Trophy className="mx-auto text-yellow-500 mb-2" size={48} />
        <h2 className="text-2xl font-bold text-slate-900">Solved!</h2>
        <p className="text-slate-500 mt-2 mb-6">Completed in {attempts} attempts.</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold"
        >
          Next Puzzle
        </button>
      </div>
    </div>
  );
};