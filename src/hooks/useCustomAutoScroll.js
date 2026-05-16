import { useEffect, useRef } from 'react';

export function useCustomAutoScroll(activeId, boundsRef) {
  const pointerY = useRef(null);
  const rafRef = useRef(null);

  // Globally track pointer Y in viewport coordinates
  useEffect(() => {
    if (!activeId) return;

    const handleMove = (e) => {
      pointerY.current = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    };

    window.addEventListener('pointermove', handleMove, { capture: true, passive: true });
    window.addEventListener('touchmove', handleMove, { capture: true, passive: true });

    return () => {
      window.removeEventListener('pointermove', handleMove, { capture: true });
      window.removeEventListener('touchmove', handleMove, { capture: true });
    };
  }, [activeId]);

  useEffect(() => {
    if (!activeId) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      pointerY.current = null;
      return;
    }

    const scrollLoop = () => {
      if (pointerY.current !== null && boundsRef.current) {
        const threshold = 60;
        const maxSpeed = 15;
        const y = pointerY.current;
        const rect = boundsRef.current.getBoundingClientRect();

        // Target 0px from top to completely hide the title area
        if (y < threshold) {
          if (rect.top < 0) {
            const speed = Math.max(1, maxSpeed * (1 - y / threshold));
            window.scrollBy(0, -speed);
          }
        }
        else if (y > window.innerHeight - threshold) {
          if (rect.bottom > window.innerHeight) {
            const dist = y - (window.innerHeight - threshold);
            const speed = Math.max(1, maxSpeed * (dist / threshold));
            window.scrollBy(0, speed);
          }
        }
      }
      rafRef.current = requestAnimationFrame(scrollLoop);
    };

    rafRef.current = requestAnimationFrame(scrollLoop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [activeId, boundsRef]);
}
