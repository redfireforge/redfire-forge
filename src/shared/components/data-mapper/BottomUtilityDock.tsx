import type { Mapping, MapperSource, ExpressionFunction } from './types';
import CodeView from './CodeView';
import MappingTableView from './MappingTableView';
import PreviewBar from './PreviewBar';
import type { MappingTrace } from './utils/mappingTrace';

interface BottomUtilityDockProps {
  mode: 'code' | 'preview' | 'table';
  mappings: Mapping[];
  sources: MapperSource[];
  activeSourceId: string;
  targetSampleData: unknown;
  customFunctions?: ExpressionFunction[];
  debugMode: boolean;
  traceByMappingId: Map<string, MappingTrace> | null;
  selectedMappingId: string | null;
  onRemoveMapping: (id: string) => void;
  onSelectMapping: (id: string) => void;
}

export default function BottomUtilityDock({
  mode,
  mappings,
  sources,
  activeSourceId,
  targetSampleData,
  customFunctions,
  debugMode,
  traceByMappingId,
  selectedMappingId,
  onRemoveMapping,
  onSelectMapping,
}: BottomUtilityDockProps) {
  return (
    <div className={`dm-bottom-utility-dock dm-bottom-utility-dock--${mode}`}>
      {mode === 'code' ? (
        <CodeView
          mappings={mappings}
          sources={sources}
          activeSourceId={activeSourceId}
          targetSampleData={targetSampleData}
          customFunctions={customFunctions}
          debugMode={debugMode}
          traceByMappingId={traceByMappingId}
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
