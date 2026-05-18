import { useEffect, useRef, useState } from 'react';

/**
 * Returns `true` for ~280ms whenever `selectedIteration` changes,
 * enabling CSS transition animations between iterations.
 */
export function useIterationTransition(selectedIteration: number | undefined): boolean {
  const [transitioning, setTransitioning] = useState(false);
  const prevIterRef = useRef(selectedIteration);

  useEffect(() => {
    if (prevIterRef.current !== selectedIteration) {
      prevIterRef.current = selectedIteration;
      setTransitioning(true);
      const timer = setTimeout(() => setTransitioning(false), 280);
      return () => clearTimeout(timer);
    }
  }, [selectedIteration]);

  return transitioning;
}
