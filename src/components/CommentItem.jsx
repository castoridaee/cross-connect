import React from 'react';
import { Heart, User } from 'lucide-react';

export const CommentItem = ({ comment, isLiked, onLike, currentUsername }) => {
  const { author, content, created_at, likes_count, is_shadowbanned } = comment;

  const formatDistanceToNow = (date) => {
    const diff = new Date() - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
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
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center text-white">
            <User size={12} />
          </div>
          <span className="text-sm font-black uppercase tracking-tight text-slate-900">
            {author?.nickname || 'Anonymous'}
          </span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            • {formatDistanceToNow(created_at)}
          </span>
        </div>
        <button 
          onClick={() => onLike(comment.id)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all active:scale-95 ${
            isLiked ? 'bg-pink-50 text-pink-500' : 'bg-slate-50 text-slate-400 hover:text-slate-600'
          }`}
        >
          <Heart size={12} fill={isLiked ? 'currentColor' : 'none'} />
          <span className="text-sm font-black">{likes_count || 0}</span>
        </button>
      </div>
      <p className="text-sm sm:text-base font-bold text-slate-600 leading-relaxed">
        {renderContent(content)}
      </p>
    </div>
  );
};
