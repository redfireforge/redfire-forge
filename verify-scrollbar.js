/**
 * Manual verification script for Response Detail modal scrollbar
 * 
 * To test:
 * 1. Open browser DevTools console
 * 2. Navigate to Results tab with test data
 * 3. Click a result row to open Response Detail modal
 * 4. Paste this script and run it
 * 5. Check output - should show scrollbar width increases from 5px → 10px when expanded
 */

function verifyResponseDetailScrollbar() {
  const results = [];
  
  // Check modal exists
  const modal = document.querySelector('.response-detail-modal');
  if (!modal) {
    return { error: 'Modal not found. Open a Response Detail modal first.' };
  }
  
  const body = document.querySelector('.response-detail-body');
  if (!body) {
    return { error: 'Modal body not found' };
  }
  
  // Check current state
  const isExpanded = modal.classList.contains('modal-fullscreen') || modal.classList.contains('modal-expanded');
  
  // Get computed scrollbar styles
  const bodyStyles = window.getComputedStyle(body);
  const scrollbarWidth = window.getComputedStyle(body, '::-webkit-scrollbar').width;
  const scrollbarTrack = window.getComputedStyle(body, '::-webkit-scrollbar-track').background;
  
  results.push({
    state: isExpanded ? 'EXPANDED' : 'NORMAL',
    scrollbarWidth,
    scrollbarTrack,
    bodyFlex: bodyStyles.flex,
    bodyMinHeight: bodyStyles.minHeight,
    bodyOverflow: bodyStyles.overflowY,
    modalOverflow: window.getComputedStyle(modal).overflow,
  });
  
  return {
    currentState: results[0],
    expected: {
      normal: { scrollbarWidth: '5px', scrollbarTrack: 'transparent or rgba(0, 0, 0, 0)' },
      expanded: { scrollbarWidth: '10px', scrollbarTrack: 'rgba(0, 0, 0, 0.1) or similar' },
    },
    passed: isExpanded 
      ? scrollbarWidth === '10px'
      : scrollbarWidth === '5px',
    instructions: isExpanded
      ? 'Click shrink button (⊖) to test normal mode'
      : 'Click expand button (⊕) to test expanded mode',
  };
}

console.log('=== Response Detail Modal Scrollbar Verification ===');
console.log(JSON.stringify(verifyResponseDetailScrollbar(), null, 2));
