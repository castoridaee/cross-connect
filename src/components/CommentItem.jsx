import React from 'react';
import Avatar from "boring-avatars";
import { Heart } from 'lucide-react';

export const CommentItem = ({ comment, isLiked, onLike, userId, puzzleAuthorId }) => {
  const { author, content, created_at, likes_count, is_shadowbanned } = comment;
  const avatarColors = ["#5cacc4", "#8cd19d", "#cee879", "#fcb653", "#ff5254"];
  const isAuthor = userId && author?.id && userId === author.id;
  const isPuzzleAuthor = puzzleAuthorId && author?.id && author.id === puzzleAuthorId;

  const formatDistanceToNow = (date) => {
    const diff = new Date() - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'now';
  };

  const renderContent = (text) => {
    // Regex to find @mentions (now matches any non-space characters)
    const parts = text.split(/(@\S+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-indigo-600 font-black hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="bg-white p-5 sm:p-4 rounded-3xl sm:rounded-2xl border border-slate-200 shadow-sm mb-4 sm:mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
          <Avatar
            size={Math.min(window.innerWidth < 640 ? 48 : 64, 64)}
            name={author?.id || 'anonymous'}
            variant="beam"
            colors={avatarColors}
            square
          />
          <div className="flex flex-col justify-center gap-2 sm:gap-2 text-left">
            <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 leading-none">
              {author?.nickname || 'Anonymous'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-bold text-slate-500 tracking-tight leading-none">
                {formatDistanceToNow(created_at)}
              </span>
              {isPuzzleAuthor && (
                 <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-indigo-200">
                   Creator
                 </span>
              )}
            </div>
          </div>
        </div>
        {!isAuthor && (
          <button 
            onClick={() => onLike(comment.id)}
            className={`flex items-center gap-2 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-xl transition-all active:scale-95 ${
              isLiked ? 'bg-pink-50 text-pink-500' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
            }`}
          >
            <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-base sm:text-lg font-black">{likes_count || 0}</span>
          </button>
        )}
      </div>
      <p className="text-base sm:text-lg font-normal text-slate-600 leading-relaxed">
        {renderContent(content)}
      </p>
    </div>
  );
};
