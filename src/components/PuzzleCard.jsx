import React from 'react';
import { Calendar, Gauge, Play, EyeOff, MoreVertical, Heart, Clock, BarChart2, Check, SkipForward, Share2 } from 'lucide-react';
import { StatTooltip } from './StatTooltip';
import { recordPuzzleShare } from '../lib/puzzleService';
import { generateShareText, copyToClipboard } from '../utils/shareUtils';

export function PuzzleCard({ 
  puzzle, 
  solveStatus, 
  likeStatus,
  tab, 
  onNavigateToPuzzle, 
  onActionClick,
  currentUser,
  onEditPuzzle
}) {
  const [showCopied, setShowCopied] = React.useState(false);
  const isAuthor = !!onActionClick || tab === 'unpublished';
  const isPuzzleOwner = currentUser?.id === puzzle.created_by;
  const hasPopulatedStats = puzzle.solve_count > 0;
  
  // Format the date
  const dateObj = new Date(puzzle.created_at);
  const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const fullDate = dateObj.toLocaleString();

  // Difficulty formatting
  const rawDiff = puzzle.difficulty_score;
  const diffScore = rawDiff != null ? Math.min(100, Math.max(0, Math.round(rawDiff * 30))) : null;
  let diffBadge = null;
  if (diffScore != null) {
    if (diffScore < 30) diffBadge = { label: 'Easy', color: 'bg-green-50 text-green-700' };
    else if (diffScore < 70) diffBadge = { label: 'Medium', color: 'bg-yellow-50 text-yellow-700' };
    else diffBadge = { label: 'Hard', color: 'bg-red-50 text-red-700' };
  }

  // Time formatting
  const timeStr = puzzle.median_time_to_solve ? 
    `${Math.floor(puzzle.median_time_to_solve / 60)}m ${Math.round(puzzle.median_time_to_solve % 60)}s` : null;

  return (
    <div key={puzzle.id} className="group relative bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 relative z-10">
        
        {/* Left section: Info */}
        <div className="flex-1 space-y-3">
          
          {/* Title Row */}
          <div className="flex items-center gap-3 flex-wrap flex-start">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
              {puzzle.title}
            </h3>
            {!puzzle.is_published && (
              <span className="bg-orange-100 text-orange-800 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shrink-0 border border-orange-200 shadow-sm leading-none flex items-center h-fit">
                Draft
              </span>
            )}
            {!isAuthor && likeStatus && likeStatus[puzzle.id] && (
              <StatTooltip label="You liked this puzzle">
                <div className="bg-pink-50 text-pink-500 p-1.5 sm:p-2 rounded-xl border border-pink-100 shadow-sm shrink-0 flex items-center justify-center">
                  <Heart size={16} fill="currentColor" />
                </div>
              </StatTooltip>
            )}
            {solveStatus && solveStatus[puzzle.id] === 'solved' && (
              <span className="bg-green-100 text-green-800 text-[10px] sm:text-xs font-black uppercase tracking-widest px-3 py-1 sm:py-1.5 rounded-xl shrink-0 border border-green-200 shadow-sm flex items-center gap-1">
                <Check size={14} strokeWidth={3} /> Solved
              </span>
            )}
            {solveStatus && solveStatus[puzzle.id] === 'skipped' && (
              <span className="bg-slate-100 text-slate-500 text-[10px] sm:text-xs font-black uppercase tracking-widest px-3 py-1 sm:py-1.5 rounded-xl shrink-0 border border-slate-200 shadow-sm flex items-center gap-1">
                <SkipForward size={14} strokeWidth={3} /> Skipped
              </span>
            )}
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* Date Badge */}
            <StatTooltip label={`Created:\n${fullDate}`}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 font-bold text-xs border border-slate-100 shadow-sm hover:bg-slate-100 transition-colors">
                <Calendar size={14} className="opacity-70" />
                <span>{formattedDate}</span>
              </div>
            </StatTooltip>

            {/* Divider */}
            {(isAuthor || hasPopulatedStats) && (
              <div className="w-px h-5 bg-slate-200 mx-1" />
            )}

            {/* Metrics */}
            {hasPopulatedStats && (
              <>
                <StatTooltip label="Community Likes">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-50 text-pink-600 font-bold text-xs shadow-sm hover:bg-pink-100 transition-colors border border-pink-100/50">
                    <Heart size={14} className="fill-current" />
                    <span>{puzzle.likes_count || 0}</span>
                  </div>
                </StatTooltip>

                {isPuzzleOwner && (
                  <StatTooltip label="Solve Rate">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs shadow-sm hover:bg-emerald-100 transition-colors border border-emerald-100/50">
                      <Check size={14} strokeWidth={3} className="text-emerald-500" />
                      <span>{Math.round((puzzle.solve_count / puzzle.play_count) * 100)}%</span>
                    </div>
                  </StatTooltip>
                )}

                {diffBadge && (
                  <StatTooltip label={`Difficulty Score\n${Math.round(diffScore)} / 100`}>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-colors border ${diffBadge.color.replace('text', 'border').replace('50', '100/50')} hover:brightness-95`}>
                      <Gauge size={14} className="opacity-70" />
                      <span>{diffBadge.label}</span>
                    </div>
                  </StatTooltip>
                )}

                {isPuzzleOwner && timeStr && (
                  <StatTooltip label="Median Solve Time">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs shadow-sm hover:bg-blue-100 transition-colors border border-blue-100/50">
                      <Clock size={14} className="opacity-70" />
                      <span>{timeStr}</span>
                    </div>
                  </StatTooltip>
                )}

                {isPuzzleOwner && puzzle.trimmean_attempts_to_solve != null && (
                  <StatTooltip label="Average Number of Attempts (Guesses + Hints)">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs shadow-sm hover:bg-purple-100 transition-colors border border-purple-100/50">
                      <BarChart2 size={14} className="opacity-70" />
                      <span>{Math.round(puzzle.trimmean_attempts_to_solve * 10) / 10}</span>
                    </div>
                  </StatTooltip>
                )}
              </>
            )}
            
            {!hasPopulatedStats && isAuthor && puzzle.is_published && (
              <span className="text-xs font-bold text-slate-400 px-2">No plays yet</span>
            )}
          </div>
        </div>
        
        {/* Right section: Action */}
        <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-slate-100 flex-wrap sm:flex-nowrap">
          {puzzle.is_published && (
            <>
              <button 
                onClick={async () => {
                  const text = generateShareText(puzzle);
                  copyToClipboard(text, () => {
                    setShowCopied(true);
                    setTimeout(() => setShowCopied(false), 2000);
                  });
                  if (currentUser) {
                    await recordPuzzleShare(currentUser.id, puzzle.id);
                  }
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-4 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-lg min-w-[100px] bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-50 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-slate-200"
              >
                {showCopied ? <Check size={16} className="text-green-600" /> : <Share2 size={16} />}
                <span className="break-words">{showCopied ? 'Copied' : 'Share'}</span>
              </button>
              <button 
                onClick={() => onNavigateToPuzzle(puzzle)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-8 py-4 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-lg min-w-[140px] bg-slate-900 text-white hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-slate-200`}
              >
                <Play size={16} fill="currentColor" /> 
                <span className="break-words">
                  {isPuzzleOwner || ['played', 'liked', 'skipped'].includes(tab) ? 'View' : 'Play'}
                </span>
              </button>
            </>
          )}

          {isPuzzleOwner && !puzzle.is_published && (
            <button 
              onClick={() => onEditPuzzle?.(puzzle)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-8 py-4 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-lg min-w-[140px] bg-slate-900 text-white hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-slate-200`}
            >
              <EyeOff size={16} /> Edit Draft
            </button>
          )}
          
          {/* Options button (Only for Author Profiles) */}
          {isAuthor && onActionClick && (
            <button
              onClick={() => onActionClick(puzzle)}
              className="flex items-center justify-center w-12 sm:w-14 py-4 sm:py-3.5 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all shadow-lg active:scale-95"
              aria-label="Manage puzzle"
            >
              <MoreVertical size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
