import { useState, useEffect } from 'react';

export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState('up');
  const [prevOffset, setPrevOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      // Ignore scroll events while a drag is actively happening to prevent header pop-ups
      if (document.body.classList.contains('is-dragging')) {
        setPrevOffset(window.pageYOffset); // Keep offset synced so it doesn't jump after drag
        return;
      }
      
      const currentOffset = window.pageYOffset;
      const direction = currentOffset > prevOffset ? 'down' : 'up';
      
      if (direction !== scrollDirection && Math.abs(currentOffset - prevOffset) > 10) {
        setScrollDirection(direction);
      }
      setPrevOffset(currentOffset);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollDirection, prevOffset]);

  return scrollDirection;
}
