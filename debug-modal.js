// Step-by-step debug script for Response Detail modal
// Paste this in browser console

console.log('=== Step 1: Check if modal is open ===');
const modal = document.querySelector('.response-detail-modal');
console.log('Modal found:', modal ? 'YES' : 'NO');

if (!modal) {
  console.log('❌ Modal not found. Please:');
  console.log('1. Go to Results tab');
  console.log('2. Click any row in the results table');
  console.log('3. Modal should appear');
  console.log('4. Then run this script again');
} else {
  console.log('✓ Modal is open');
  
  console.log('\n=== Step 2: Check modal classes ===');
  console.log('Modal classes:', modal.className);
  const isExpanded = modal.classList.contains('modal-fullscreen') || modal.classList.contains('modal-expanded');
  console.log('Is expanded?', isExpanded ? 'YES (fullscreen/expanded)' : 'NO (normal mode)');
  
  console.log('\n=== Step 3: Check body element ===');
  const body = document.querySelector('.response-detail-body');
  console.log('Body found:', body ? 'YES' : 'NO');
  
  if (body) {
    console.log('\n=== Step 4: Check scrollbar styles ===');
    
    // Try to get scrollbar width
    try {
      const scrollbarStyle = window.getComputedStyle(body, '::-webkit-scrollbar');
      const width = scrollbarStyle.width;
      const display = scrollbarStyle.display;
      
      console.log('Scrollbar width:', width || 'not set');
      console.log('Scrollbar display:', display || 'not set');
      
      // Get regular body styles
      const bodyStyle = window.getComputedStyle(body);
      console.log('Body overflow-y:', bodyStyle.overflowY);
      console.log('Body flex:', bodyStyle.flex);
      console.log('Body min-height:', bodyStyle.minHeight);
      
      // Get modal layout
      const modalStyle = window.getComputedStyle(modal);
      console.log('\n=== Step 5: Check modal layout ===');
      console.log('Modal overflow:', modalStyle.overflow);
      console.log('Modal display:', modalStyle.display);
      console.log('Modal flex-direction:', modalStyle.flexDirection);
      
      // Check if there's scrollable content
      console.log('\n=== Step 6: Check if content is scrollable ===');
      console.log('Body scrollHeight:', body.scrollHeight);
      console.log('Body clientHeight:', body.clientHeight);
      console.log('Is scrollable?', body.scrollHeight > body.clientHeight ? 'YES' : 'NO (content fits, scrollbar may be hidden)');
      
      console.log('\n=== Step 7: Expected values ===');
      if (isExpanded) {
        console.log('Expected scrollbar width: 10px');
        console.log('Actual scrollbar width:', width);
        console.log('Match?', width === '10px' ? '✓ YES' : '❌ NO');
      } else {
        console.log('Expected scrollbar width: 5px');
        console.log('Actual scrollbar width:', width);
        console.log('Match?', width === '5px' ? '✓ YES' : '❌ NO');
      }
      
      console.log('\n=== Action: Toggle expand to test ===');
      const expandBtn = document.querySelector('.modal-expand-btn');
      if (expandBtn) {
        console.log('✓ Expand button found');
        console.log('Click it to toggle, then run this script again');
      } else {
        console.log('❌ Expand button not found');
      }
      
    } catch (e) {
      console.error('Error getting styles:', e);
    }
  }
}
