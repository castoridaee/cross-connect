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
    if (!label || size !== 'md') return null;

    let fontSize = 11; // Default md font size

    // 1. Calculate size based on longest word
    const parts = label.split(/\s+/);
    const maxLen = Math.max(...parts.map(p => p.length));
    if (maxLen >= 12) fontSize = 7;
    else if (maxLen >= 11) fontSize = 8;
    else if (maxLen >= 9) fontSize = 9;
    else if (maxLen >= 8) fontSize = 10;

    // 2. Calculate size based on overall phrase length
    if (label.length > 44) {
      fontSize = Math.min(fontSize, 9);
    } else if (label.length > 32) {
      fontSize = Math.min(fontSize, 10);
    }

    return fontSize < 11 ? `${fontSize}px` : null;
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
