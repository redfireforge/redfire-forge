import type { Assertion } from '../../types';
import type { Mapping, MapperSource, ExpressionFunction } from './types';
import type { AssertionRowVerifyResult } from './InlineAssertionRow';
import CodeView from './CodeView';
import MappingTableView from './MappingTableView';
import PreviewBar from './PreviewBar';
import type { MappingTrace } from './utils/mappingTrace';

interface BottomUtilityDockProps {
  mode: 'code' | 'preview' | 'table';
  mappings: Mapping[];
  assertions?: Assertion[];
  sources: MapperSource[];
  activeSourceId: string;
  targetSampleData: unknown;
  customFunctions?: ExpressionFunction[];
  debugMode: boolean;
  traceByMappingId: Map<string, MappingTrace> | null;
  selectedMappingId: string | null;
  onRemoveMapping: (id: string) => void;
  onSelectMapping: (id: string) => void;
  verifyStatus?: string;
  failedMappingIds?: Set<string>;
  assertionVerifyMap?: Map<number, AssertionRowVerifyResult>;
  style?: React.CSSProperties;
}

export default function BottomUtilityDock({
  mode,
  mappings,
  assertions,
  sources,
  activeSourceId,
  targetSampleData,
  customFunctions,
  debugMode,
  traceByMappingId,
  selectedMappingId,
  onRemoveMapping,
  onSelectMapping,
  verifyStatus,
  failedMappingIds,
  assertionVerifyMap,
  style,
}: BottomUtilityDockProps) {
  return (
    <div className={`dm-bottom-utility-dock dm-bottom-utility-dock--${mode}`} style={style}>
      {mode === 'code' ? (
        <CodeView
          mappings={mappings}
          assertions={assertions}
          sources={sources}
          activeSourceId={activeSourceId}
          targetSampleData={targetSampleData}
          customFunctions={customFunctions}
          debugMode={debugMode}
          traceByMappingId={traceByMappingId}
          verifyStatus={verifyStatus}
          failedMappingIds={failedMappingIds}
          assertionVerifyMap={assertionVerifyMap}
        />
      ) : mode === 'table' ? (
        <MappingTableView
          mappings={mappings}
          sources={sources}
          activeSourceId={activeSourceId}
          onRemoveMapping={onRemoveMapping}
          onSelectMapping={onSelectMapping}
          selectedMappingId={selectedMappingId}
        />
      ) : (
        <PreviewBar
          mappings={mappings}
          sources={sources}
          activeSourceId={activeSourceId}
          targetSampleData={targetSampleData}
          customFunctions={customFunctions}
        />
      )}
    </div>
  );
}
