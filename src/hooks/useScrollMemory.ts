import { useEffect, useRef, useState } from 'react';

interface UseScrollMemoryOptions {
  /**
   * Delay in ms before restoring scroll position (allows DOM to settle)
   * Default: 100ms
   */
  restoreDelay?: number;
  
  /**
   * Whether to use window scroll or a specific container
   * Default: 'window'
   */
  scrollTarget?: 'window' | HTMLElement | null;
}

export function useScrollMemory(options: UseScrollMemoryOptions = {}) {
  const { restoreDelay = 100, scrollTarget = 'window' } = options;
  
  // Store the scroll position
  const savedScrollPos = useRef<number>(0);
  const restoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [shouldRestore, setShouldRestore] = useState(false);

  /**
   * Call before opening a modal to save current scroll position
   */
  const saveScrollPosition = () => {
    if (scrollTarget === 'window') {
      savedScrollPos.current = window.scrollY || document.documentElement.scrollTop;
    } else if (scrollTarget instanceof HTMLElement) {
      savedScrollPos.current = scrollTarget.scrollTop;
    }
    
    console.log('[ScrollMemory] Saved scroll position:', savedScrollPos.current);
  };

  /**
   * Call after modal closes and data refresh completes
   * This triggers the restoration with a delay
   */
  const restoreScrollPosition = () => {
    setShouldRestore(true);
  };

  /**
   * Effect to handle the actual restoration
   */
  useEffect(() => {
    if (!shouldRestore) return;

    // Clear any existing timeout
    if (restoreTimeoutRef.current) {
      clearTimeout(restoreTimeoutRef.current);
    }

    // Schedule restoration after delay (allows DOM to update)
    restoreTimeoutRef.current = setTimeout(() => {
      const targetPos = savedScrollPos.current;
      
      if (scrollTarget === 'window') {
        window.scrollTo({
          top: targetPos,
          behavior: 'instant'
        });
      } else if (scrollTarget instanceof HTMLElement) {
        scrollTarget.scrollTo({
          top: targetPos,
          behavior: 'instant'
        });
      }
      
      console.log('[ScrollMemory] Restored scroll position to:', targetPos);
      setShouldRestore(false);
    }, restoreDelay);

    return () => {
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current);
      }
    };
  }, [shouldRestore, restoreDelay, scrollTarget]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
  };
}
