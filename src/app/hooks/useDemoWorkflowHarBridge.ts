import { useEffect } from 'react';
import type { HarParseResult } from '@workflow/utils/harParser';
import { parseHarEntries } from '@workflow/utils/harParser';

/**
 * Demo-player bridge for the Workflow Designer HAR import.
 *   - `__wfTriggerHarImport(harText, fileName?)` — parse HAR JSON text and open
 *     the preview modal as if the user had selected the file via the toolbar button.
 *
 * Used by the `wf-har-import` demo lesson to inject a fixture HAR without
 * driving the native OS file picker, which cannot be automated.
 */
export function useDemoWorkflowHarBridge(
  onHarFileParsed: (result: HarParseResult, fileName: string) => void,
): void {
  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;

    win.__wfTriggerHarImport = (harText: string, fileName = 'demo-fixture.har') => {
      const result = parseHarEntries(harText);
      onHarFileParsed(result, fileName);
    };

    return () => {
      delete win.__wfTriggerHarImport;
    };
  }, [onHarFileParsed]);
}
