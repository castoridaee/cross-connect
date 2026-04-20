import React from 'react';
import { Calendar, Gauge, Play, EyeOff, MoreVertical, Heart, Clock, BarChart2, Check, SkipForward, Share2 } from 'lucide-react';
import { StatTooltip } from './StatTooltip';
import { recordPuzzleShare } from '../lib/puzzleService';
import { generateShareText, copyToClipboard } from '../utils/shareUtils';

function PuzzleGridPreview({ layout }) {
  if (!layout || !layout.length) return null;
  const numRows = layout.length;
  const numCols = layout[0].length;
  const maxDim = Math.max(numRows, numCols);

  return (
    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-950 rounded-sm flex items-center justify-center p-2.5 sm:p-3 shrink-0 shadow-sm border border-slate-800">
      <div
        className="grid gap-[1px]"
        style={{
          gridTemplateColumns: `repeat(${numCols}, 1fr)`,
          width: numCols >= numRows ? '100%' : `${(numCols / numRows) * 100}%`,
          height: numRows >= numCols ? '100%' : `${(numRows / numCols) * 100}%`
        }}
      >
        {layout.flat().map((active, i) => (
          <div
            key={i}
            className={`aspect-square ${active ? 'bg-gray-100' : 'bg-slate-800'}`}
          />
        ))}
      </div>
    </div>
  );
}

export function PuzzleCard({
  puzzle,
  solveStatus,
  likeStatus,
  tab,
  onNavigateToPuzzle,
  onActionClick,
  currentUser,
  onEditPuzzle,
  onLike
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
    <div key={puzzle.id} className="group relative bg-white p-5 sm:p-4 rounded-3xl sm:rounded-2xl border border-slate-200 shadow-sm mb-4 sm:mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 hover:shadow-md transition-all">
      <div className="flex flex-col gap-4 relative z-10">

        {/* Top Section: Header & Badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 flex items-start gap-4 sm:gap-5 min-w-0">
            <PuzzleGridPreview layout={puzzle.layout} />
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1.5 truncate">
                {puzzle.title}
              </h3>
              <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest leading-none">
                <span>Created {formattedDate}</span>
                {!puzzle.is_published && (
                  <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100">Draft</span>
                )}
              </div>
            </div>
          </div>

          {/* Top Right Badges (Solved/Liked/etc) */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {solveStatus && solveStatus[puzzle.id] === 'solved' && (
              <div className="bg-green-50 text-green-600 p-2 rounded-xl border border-green-100 shadow-sm" title="Solved">
                <Check size={18} strokeWidth={3} />
              </div>
            )}
            {solveStatus && solveStatus[puzzle.id] === 'skipped' && (
              <div className="bg-slate-50 text-slate-400 p-2 rounded-xl border border-slate-100 shadow-sm" title="Skipped">
                <SkipForward size={18} strokeWidth={3} />
              </div>
            )}
            {!isAuthor && likeStatus && likeStatus[puzzle.id] && (
              <div className="bg-pink-50 text-pink-500 p-2 rounded-xl border border-pink-100 shadow-sm" title="You liked this">
                <Heart size={18} fill="currentColor" />
              </div>
            )}
          </div>
        </div>

        {/* Middle Section: Metrics Bar */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap px-1">
          {hasPopulatedStats && (
            <>
              <StatTooltip label="Total Community Likes">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-tight text-slate-400 cursor-help">
                  <Heart size={13} className="opacity-70" />
                  <span>{puzzle.likes_count || 0}</span>
                </div>
              </StatTooltip>
              <div className="w-1 h-1 bg-slate-200 rounded-full" />
              <StatTooltip label={`${puzzle.play_count || 0} users have started this puzzle`}>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-tight text-slate-500 cursor-help">
                  <Play size={14} fill="currentColor" />
                  <span>{puzzle.play_count || 0} plays</span>
                </div>
              </StatTooltip>
              {diffBadge && (
                <>
                  <div className="w-1 h-1 bg-slate-200 rounded-full" />
                  <StatTooltip label={`Difficulty: ${Math.round(puzzle.difficulty_score * 30)} / 100`}>
                    <div className={`text-[10px] sm:text-xs font-black uppercase tracking-tight cursor-help ${diffBadge.color.replace('bg-', 'text-').replace('-50', '-700')}`}>
                      {diffBadge.label}
                    </div>
                  </StatTooltip>
                </>
              )}
            </>
          )}
          {!hasPopulatedStats && isAuthor && puzzle.is_published && (
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-tight text-slate-300 italic">No plays yet</span>
          )}
        </div>

        {/* Bottom Section: Actions */}
        <div className="flex flex-row justify-end items-center gap-2 pt-1 border-t border-slate-50">
          {(tab === 'played' || tab === 'liked') && currentUser && onLike && (
            <button
              onClick={() => onLike(puzzle.id)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border shadow-sm active:scale-95 ${
                likeStatus[puzzle.id] 
                ? 'bg-pink-50 text-pink-500 border-pink-100' 
                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
              }`}
              title={likeStatus[puzzle.id] ? "Unlike" : "Like"}
            >
              <Heart size={14} fill={likeStatus[puzzle.id] ? 'currentColor' : 'none'} />
              <span>{likeStatus[puzzle.id] ? 'Liked' : 'Like'}</span>
            </button>
          )}
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
                className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-95 shadow-sm"
              >
                {showCopied ? <Check size={14} className="text-green-600" /> : <Share2 size={14} />}
                <span>{showCopied ? 'Copied' : 'Share'}</span>
              </button>
              <button
                onClick={() => onNavigateToPuzzle(puzzle)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-slate-900 text-white hover:bg-slate-800 active:scale-95 shadow-lg shadow-slate-200"
              >
                <Play size={14} fill="currentColor" />
                <span>
                  {isPuzzleOwner || ['played', 'liked', 'skipped'].includes(tab) ? 'View' : 'Play'}
                </span>
              </button>
            </>
          )}

          {isPuzzleOwner && !puzzle.is_published && (
            <button
              onClick={() => onEditPuzzle?.(puzzle)}
              className="col-span-2 sm:col-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-slate-900 text-white hover:bg-slate-800 active:scale-95 shadow-lg shadow-slate-200"
            >
              <EyeOff size={14} /> Edit Draft
            </button>
          )}

          {isAuthor && onActionClick && (
            <button
              onClick={() => onActionClick(puzzle)}
              className="flex items-center justify-center px-2.5 py-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95 border border-slate-100"
              aria-label="Manage puzzle"
            >
              <MoreVertical size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
