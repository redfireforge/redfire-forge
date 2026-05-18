import type { ArrayMappingInfo } from './utils/arrayMapping';

interface DataMapperArraySuggestionBarProps {
  selectedArrayInfo: ArrayMappingInfo | null;
  selectedMappingId: string | null;
  onApplySuggestedExpression: (mappingId: string, expression: string) => void;
}

export default function DataMapperArraySuggestionBar({
  selectedArrayInfo,
  selectedMappingId,
  onApplySuggestedExpression,
}: DataMapperArraySuggestionBarProps) {
  if (!selectedArrayInfo) return null;

  return (
    <div className="dm-array-suggestion-bar" role="status" aria-live="polite">
      <span className="dm-array-suggestion-label">
        {selectedArrayInfo.kind === 'loop'
          ? '∞ Array → Array: elements will be mapped one-to-one'
          : selectedArrayInfo.kind === 'aggregate'
            ? 'Σ Array → Scalar: needs an aggregation expression'
            : '⤑ Scalar → Array: value will be wrapped in an array'}
      </span>
      {selectedArrayInfo.suggestedExpression && (
        <button
          type="button"
          className="dm-array-suggestion-apply"
          onClick={() => {
            if (selectedMappingId && selectedArrayInfo.suggestedExpression) {
              onApplySuggestedExpression(selectedMappingId, selectedArrayInfo.suggestedExpression);
            }
          }}
        >
          Apply: {selectedArrayInfo.suggestedExpression}
        </button>
      )}
    </div>
  );
}
