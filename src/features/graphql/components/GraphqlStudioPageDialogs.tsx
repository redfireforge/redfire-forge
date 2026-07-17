/**
 * GraphqlStudioPageDialogs — complexity gate, dedup banner, and connection modals
 * extracted from GraphqlStudioPage for maintainability.
 */
import type { ComponentProps, MutableRefObject } from 'react';
import type { ComplexityResult } from '../utils/complexityEstimator';
import type { AdvancedSettingsValues } from './GraphqlAdvancedSettings';
import { GraphqlComplexityGateModal } from './GraphqlComplexityGateModal';
import { GqlDedupBanner } from './GqlDedupBanner';
import { GqlConnectionModals } from './GqlConnectionModals';

type ConnectionModalsProps = ComponentProps<typeof GqlConnectionModals>;

export interface GraphqlStudioPageDialogsProps {
  complexityGatePending: boolean;
  complexityResult: ComplexityResult | null;
  advSettings: AdvancedSettingsValues;
  pendingExecuteAfterGateRef: MutableRefObject<(() => void) | null>;
  sessionBypassComplexityGateRef: MutableRefObject<boolean>;
  skipComplexityGateRef: MutableRefObject<boolean>;
  setComplexityGatePending: (v: boolean) => void;
  setComplexityWarningPending: (v: boolean) => void;
  isDuplicate: boolean;
  duplicateSourceTabId: string | null;
  activeTabId: string;
  resolveDedupChoice: (choice: 'wait' | 'cancel' | 'sendAnyway') => void;
  connectionModals: ConnectionModalsProps;
}

export function GraphqlStudioPageDialogs({
  complexityGatePending,
  complexityResult,
  advSettings,
  pendingExecuteAfterGateRef,
  sessionBypassComplexityGateRef,
  skipComplexityGateRef,
  setComplexityGatePending,
  setComplexityWarningPending,
  isDuplicate,
  duplicateSourceTabId,
  activeTabId,
  resolveDedupChoice,
  connectionModals,
}: GraphqlStudioPageDialogsProps) {
  return (
    <>
      {complexityGatePending && complexityResult && (
        <GraphqlComplexityGateModal
          complexityResult={complexityResult}
          blockThreshold={advSettings.complexityBlockThreshold}
          onSendAnyway={(rememberSession) => {
            setComplexityGatePending(false);
            const fn = pendingExecuteAfterGateRef.current;
            pendingExecuteAfterGateRef.current = null;
            if (fn) {
              setComplexityWarningPending(false);
              if (rememberSession) sessionBypassComplexityGateRef.current = true;
              skipComplexityGateRef.current = true;
              fn();
            }
          }}
          onCancel={() => {
            setComplexityGatePending(false);
            pendingExecuteAfterGateRef.current = null;
          }}
        />
      )}

      <GqlDedupBanner
        visible={isDuplicate && duplicateSourceTabId === activeTabId}
        onWait={() => resolveDedupChoice('wait')}
        onCancelOriginal={() => resolveDedupChoice('cancel')}
        onSendAnyway={() => resolveDedupChoice('sendAnyway')}
      />

      <GqlConnectionModals {...connectionModals} />
    </>
  );
}
