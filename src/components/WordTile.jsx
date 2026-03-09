import React from 'react';

export const WordTile = ({ label, variant = 'default', size = 'md', inGrid = false }) => {
  const sizeClasses = {
    sm: 'w-12 h-12 text-[9px]',
    md: inGrid ? 'w-full h-full text-[11px]' : 'w-16 h-16 text-[11px]',
    lg: 'w-20 h-20 text-[13px]'
  };

  const borderClass = inGrid ? '' : 'border border-black shadow-sm';

  const variants = {
    default: `bg-white text-slate-800 ${borderClass}`,
    active: `bg-white text-slate-800 ${borderClass}`,
    error: `bg-red-500 text-white ${borderClass}`,
    ghost: `bg-white ${borderClass}`,
    dark: `bg-slate-900 ${borderClass}`
  };

  const getDynamicFontSize = () => {
    if (!label) return null;
    const parts = label.split(/\s+/);
    const maxLen = Math.max(...parts.map(p => p.length));
    
    // md size is the primary concern for grid overflow
    if (size === 'md') {
      if (maxLen >= 12) return '7px';
      if (maxLen >= 11) return '8px';
      if (maxLen >= 10) return '9px';
      if (maxLen >= 9) return '10px';
    }
    return null;
  };

  const dynamicFontSize = getDynamicFontSize();

  return (
    <div 
      className={`${sizeClasses[size] || sizeClasses.md} flex-shrink-0 aspect-square flex items-center justify-center text-center p-1 font-semibold uppercase transition-all select-none break-words leading-none tracking-tighter ${variants[variant]}`}
      style={dynamicFontSize ? { fontSize: dynamicFontSize } : {}}
    >
      {label}
    </div>
  );
};
