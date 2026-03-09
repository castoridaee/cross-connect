import React, { useEffect } from 'react';
import { Edit2, Play, EyeOff, Trash2, X } from 'lucide-react';

export function PuzzleOptionsModal({ puzzle, onClose, onAction, onDelete, onUnpublish, isDeleting, isUnpublishing }) {
  // Lock body scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4 pb-8 sm:p-4">
      <div 
        className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-2 border-b border-slate-50">
          <h3 className="font-black text-lg text-slate-900 uppercase tracking-tight">Manage Puzzle</h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2">
          {/* Edit Option */}
          <button
            onClick={() => onAction('edit')}
            className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Edit2 size={18} />
            </div>
            <div>
              <div className="font-bold text-slate-900">Edit Puzzle</div>
              <div className="text-xs font-medium text-slate-500">Modify title, clues, or layout</div>
            </div>
          </button>

          <div className="h-px bg-slate-100 my-1 mx-4" />

          {/* Unpublish Option (Only if currently published) */}
          {puzzle.is_published && (
            <button
              onClick={() => onUnpublish(puzzle.id)}
              disabled={isUnpublishing}
              className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-orange-50 active:bg-orange-100 transition-colors text-left opacity-90 hover:opacity-100"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <EyeOff size={18} />
              </div>
              <div>
                <div className="font-bold text-orange-600">
                  {isUnpublishing ? 'Moving to Drafts...' : 'Unpublish (Move to Drafts)'}
                </div>
                <div className="text-xs font-medium text-orange-500/80">Hide from public, keep your data</div>
              </div>
            </button>
          )}

          {/* Delete Option */}
          <button
            onClick={() => onDelete(puzzle.id)}
            disabled={isDeleting}
            className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-red-50 active:bg-red-100 transition-colors text-left opacity-90 hover:opacity-100"
          >
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Trash2 size={18} />
            </div>
            <div>
              <div className="font-bold text-red-600">
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </div>
              <div className="text-xs font-medium text-red-500/80">This action cannot be undone</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
