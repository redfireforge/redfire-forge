import { useMemo } from 'react';
import type { ConnectionLine } from './useConnectionLines';
import { normalizeMapperPath } from '../utils/pathNormalization';
import type { LineFocusNode } from './useDataMapperTreeInteraction';

export function useMapperVisibleLines(
  lines: ConnectionLine[],
  showMappingLines: boolean,
  nodeFocusMode: boolean,
  lineFocusNode: LineFocusNode,
) {
  return useMemo(() => {
    if (showMappingLines) return lines;
    if (!nodeFocusMode || !lineFocusNode) return [];
    const fp = normalizeMapperPath(lineFocusNode.path);
    if (lineFocusNode.region === 'source') {
      return lines.filter((line) => normalizeMapperPath(line.sourcePath) === fp);
    }
    return lines.filter((line) => normalizeMapperPath(line.targetPath) === fp);
  }, [lines, showMappingLines, nodeFocusMode, lineFocusNode]);
}
