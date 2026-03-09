import React, { useState, useRef, useEffect } from 'react';

export function StatTooltip({ label, children }) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);

  const handleInteraction = (e) => {
    if (e.type === 'touchstart') {
      setIsVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsVisible(false), 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div 
      className="relative flex items-center group cursor-help"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onTouchStart={handleInteraction}
      onTouchEnd={handleInteraction}
    >
      {children}
      
      {/* Tooltip Content */}
      <div className={`
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px]
        pointer-events-none z-[100]
        transition-all duration-200
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}>
        <div className="bg-slate-900 text-white text-[10px] sm:text-xs font-bold px-3 py-2 rounded-xl shadow-xl border border-slate-700 mx-auto text-center">
          {label.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < label.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
          {/* Caret */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      </div>
    </div>
  );
}
