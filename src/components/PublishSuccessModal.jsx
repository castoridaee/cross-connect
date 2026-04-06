import React from 'react';
import { X, CheckCircle2, UserPlus, LogIn, Play } from 'lucide-react';

export const PublishSuccessModal = ({ isAnonymous, onSignIn, onSignUp, onClose }) => {
  // Lock body scroll when modal is open
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300 relative">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Close"
        >
          <X size={20} strokeWidth={2.5} />
        </button>

        <div className="p-8 text-center">

          <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Puzzle Published!</h2>
          
          {isAnonymous ? (
            <>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Your puzzle is live! Sign in or create an account to claim ownership and track its stats.
              </p>
              <div className="grid gap-3">
                <button 
                  onClick={onSignUp}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 text-xs flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
                >
                  <UserPlus size={16} /> SIGN UP
                </button>
                <button 
                  onClick={onSignIn}
                  className="w-full bg-slate-100 text-slate-700 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 text-xs flex items-center justify-center gap-2"
                >
                  <LogIn size={16} /> SIGN IN
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Your puzzle has been successfully published to the public gallery.
              </p>
              <button 
                onClick={onClose}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 text-xs flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
              >
                <Play size={16} fill="currentColor" /> PLAY YOUR PUZZLE
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
