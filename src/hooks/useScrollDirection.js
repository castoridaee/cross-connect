import { useState, useEffect } from 'react';

export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState('up');
  const [prevOffset, setPrevOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      // If a drag is actively happening, and the screen scrolls, forcefully hide the header to maximize space
      if (document.body.classList.contains('is-dragging')) {
        setPrevOffset(window.pageYOffset);
        if (scrollDirection !== 'down') {
          setScrollDirection('down');
        }
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
