import { useState, useCallback, useEffect } from 'react';

export function useSearchMatchNavigation(matchCount: number) {
  const [searchQuery, setSearchQueryState] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryState(value);
    setCurrentMatchIndex(0);
  }, []);

  useEffect(() => {
    setCurrentMatchIndex(prev => (matchCount > 0 && prev >= matchCount ? matchCount - 1 : prev));
  }, [matchCount]);

  const goNext = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentMatchIndex(prev => (prev + 1) % matchCount);
  }, [matchCount]);

  const goPrev = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentMatchIndex(prev => (prev - 1 + matchCount) % matchCount);
  }, [matchCount]);

  const clear = useCallback(() => {
    setSearchQueryState('');
    setCurrentMatchIndex(0);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    currentMatchIndex,
    setCurrentMatchIndex,
    goNext,
    goPrev,
    clear,
  };
}
