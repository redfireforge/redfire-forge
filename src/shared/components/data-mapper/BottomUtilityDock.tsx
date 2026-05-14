import type { Mapping, MapperSource, ExpressionFunction } from './types';
import CodeView from './CodeView';
import MappingTableView from './MappingTableView';
import ValidationCodeEditor from './ValidationCodeEditor';
import PreviewBar from './PreviewBar';
import type { MappingTrace } from './utils/mappingTrace';
import type { ParseError } from './utils/validationDsl';

interface BottomUtilityDockProps {
  mode: 'code' | 'preview' | 'table' | 'rules';
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
  validationDslText: string;
  onValidationCodeChange: (text: string) => void;
  validationParseErrors: ParseError[];
  validationSamplePaths: string[];
  onRulesPopOut?: () => void;
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
  validationDslText,
  onValidationCodeChange,
  validationParseErrors,
  validationSamplePaths,
  onRulesPopOut,
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
      ) : mode === 'rules' ? (
        <ValidationCodeEditor
          value={validationDslText}
          onChange={onValidationCodeChange}
          errors={validationParseErrors}
          samplePaths={validationSamplePaths}
          height={220}
          onPopOut={onRulesPopOut}
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
