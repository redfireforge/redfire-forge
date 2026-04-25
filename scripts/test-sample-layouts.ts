/**
 * Quick script to test auto-layout on all sample workflows and detect overlaps.
 * Run with: npx tsx scripts/test-sample-layouts.ts
 */
import { sampleWorkflowCatalog } from '../src/data/sampleWorkflows';
import { getAutoLayoutNodes } from '../src/utils/workflowAutoLayout';

const NODE_WIDTH = 220;
const COMPACT_WIDTH = 160;
const NODE_HEIGHT = 100;
const COMPACT_HEIGHT = 60;
const COMPACT_TYPES = new Set(['start', 'fork', 'join', 'condition', 'delay', 'end', 'webhook', 'schedule', 'switch', 'loop', 'setVariable', 'aggregate', 'errorHandler', 'logDebug', 'waitForCondition']);

function getNodeSize(type: string) {
  const isCompact = COMPACT_TYPES.has(type);
  return {
    w: isCompact ? COMPACT_WIDTH : NODE_WIDTH,
    h: isCompact ? COMPACT_HEIGHT : NODE_HEIGHT,
  };
}

function checkOverlaps(name: string, nodes: Array<{ id: string; type?: string; position: { x: number; y: number } }>) {
  const issues: string[] = [];
  
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const aSize = getNodeSize(a.type ?? 'http');
    const aRight = a.position.x + aSize.w;
    const aBottom = a.position.y + aSize.h;
    
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const bSize = getNodeSize(b.type ?? 'http');
      const bRight = b.position.x + bSize.w;
      const bBottom = b.position.y + bSize.h;
      
      // Check for overlap (with 5px tolerance)
      const overlapX = Math.max(0, Math.min(aRight, bRight) - Math.max(a.position.x, b.position.x));
      const overlapY = Math.max(0, Math.min(aBottom, bBottom) - Math.max(a.position.y, b.position.y));
      
      if (overlapX > 5 && overlapY > 5) {
        issues.push(`  OVERLAP: ${a.id} (${Math.round(a.position.x)},${Math.round(a.position.y)}) vs ${b.id} (${Math.round(b.position.x)},${Math.round(b.position.y)}) — ${Math.round(overlapX)}x${Math.round(overlapY)}px`);
      }
    }
  }
  
  // Check for nodes too close on same rank (< 20px gap)
  const MIN_GAP = 20;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const aSize = getNodeSize(a.type ?? 'http');
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const bSize = getNodeSize(b.type ?? 'http');
      
      // Same rank (within 25px y tolerance)
      if (Math.abs(a.position.y - b.position.y) < 25) {
        const gap = Math.abs(b.position.x - (a.position.x + aSize.w));
        const gap2 = Math.abs(a.position.x - (b.position.x + bSize.w));
        const actualGap = Math.min(gap, gap2);
        if (actualGap < MIN_GAP && actualGap >= 0) {
          issues.push(`  TIGHT: ${a.id} ↔ ${b.id} — only ${Math.round(actualGap)}px gap (need ${MIN_GAP}+)`);
        }
      }
    }
  }
  
  return issues;
}

console.log(`\n=== Auto-Layout Test for ${sampleWorkflowCatalog.length} Sample Workflows ===\n`);

let totalIssues = 0;
for (const entry of sampleWorkflowCatalog) {
  const wf = entry.factory();
  const laid = getAutoLayoutNodes(wf.nodes as any, wf.edges as any, 'TB');
  const issues = checkOverlaps(entry.name, laid);
  
  if (issues.length > 0) {
    console.log(`❌ ${entry.name} (${laid.length} nodes):`);
    for (const issue of issues) console.log(issue);
    totalIssues += issues.length;
  } else {
    console.log(`✅ ${entry.name} (${laid.length} nodes)`);
  }
  
  // Print positions for debugging
  console.log(`   Positions:`);
  for (const n of laid) {
    const s = getNodeSize(n.type ?? 'http');
    console.log(`     ${n.id.padEnd(25)} ${n.type?.padEnd(18) ?? ''} x=${Math.round(n.position.x).toString().padStart(4)}, y=${Math.round(n.position.y).toString().padStart(4)} (${s.w}x${s.h})`);
  }
  console.log('');
}

console.log(`\n${totalIssues === 0 ? '✅ All layouts OK!' : `❌ ${totalIssues} issues found`}\n`);
