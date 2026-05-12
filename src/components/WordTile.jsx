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
    // potentially use @chenglou/pretext or something similar if issues come up
    // but for simplicity stick with heuristic for now

    if (!label || size !== 'md') return null;
    if (!label.trim()) return null;

    const trimmed = label.trim();

    // Accurate visual character count (handles complex ZWJ emojis, skin tones, etc.)
    let len = [...trimmed].length;
    if (typeof Intl.Segmenter !== 'undefined') {
      try {
        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        len = [...segmenter.segment(trimmed)].length;
      } catch (e) {
        // Fallback to spread if segmenter fails
      }
    }
    // Note that individual word count check elsewhere still doesn't work here.
    // for example, 🏳️‍🌈🏳️‍🌈🏳️‍🌈 gives "INDIVIDUAL WORDS CANNOT EXCEED 12 LETTERS!"
    // I will leave this as is since it's such a rare case. And also those
    // ZWJ emojis are sometimes visually wide and really shouldn't be 12
    // characters long.

    // A. Scale UP for very short words/single letters/emojis
    if (len === 1) return '40px';
    if (len === 2) return '20px';
    if (len === 3) return '12px';

    // B. Scale DOWN for long words/phrases
    let fontSize = 11; // Default md font size
    const rawLen = trimmed.length;

    // Calculate size based on longest word
    const parts = trimmed.split(/\s+/);
    const maxLen = Math.max(...parts.map(p => p.length));
    if (maxLen >= 12) fontSize = 7;
    else if (maxLen >= 11) fontSize = 8;
    else if (maxLen >= 9) fontSize = 9;
    else if (maxLen >= 8) fontSize = 10;

    // C. Calculate size based on overall phrase length
    if (rawLen > 44) {
      fontSize = Math.min(fontSize, 9);
    } else if (rawLen > 32) {
      fontSize = Math.min(fontSize, 10);
    }

    return fontSize !== 11 ? `${fontSize}px` : null;
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
