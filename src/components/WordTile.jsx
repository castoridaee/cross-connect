import React from 'react';

export const WordTile = ({ label, variant = 'default', size = 'md', inGrid = false }) => {
  const sizeClasses = {
    sm: 'w-12 h-12 text-[9px]',
    md: 'w-16 h-16 text-[11px]',
    lg: 'w-20 h-20 text-[13px]'
  };

  const borderClass = inGrid ? 'border-r-2 border-b-2 border-black' : 'border border-black shadow-sm';

  const variants = {
    default: `bg-white text-slate-800 ${borderClass}`,
    active: `bg-indigo-600 text-white ${borderClass}`,
    error: `bg-red-500 text-white ${borderClass}`,
    ghost: `bg-white ${borderClass}`
  };

  return (
    <div className={`${sizeClasses[size] || sizeClasses.md} flex-shrink-0 aspect-square flex items-center justify-center text-center p-1 font-semibold uppercase transition-all select-none break-words leading-none tracking-tighter ${variants[variant]}`}>
      {label}
    </div>
  );
};
