import React from 'react';

export const WordTile = ({ label, variant = 'default', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12 text-[7px]',
    md: 'w-16 h-16 text-[9px]',
    lg: 'w-20 h-20 text-[11px]'
  };

  const variants = {
    default: 'bg-white text-slate-800 border border-slate-300 shadow-sm',
    active: 'bg-indigo-600 text-white shadow-md',
    error: 'bg-red-500 text-white',
    ghost: 'bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400'
  };

  return (
    <div className={`${sizeClasses[size] || sizeClasses.md} flex items-center justify-center text-center p-1 rounded-md font-bold uppercase transition-all select-none ${variants[variant]}`}>
      {label}
    </div>
  );
};
