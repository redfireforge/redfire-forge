/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import BottomUtilityDock from './BottomUtilityDock';
import type { Mapping, MapperSource } from './types';
import type { ParseError } from './utils/validationDsl';

vi.mock('./CodeView', () => ({
  default: () => <div data-testid="dock-code-view" />,
}));

vi.mock('./MappingTableView', () => ({
  default: () => <div data-testid="dock-table-view" />,
}));

vi.mock('./ValidationCodeEditor', () => ({
  default: () => <div data-testid="dock-rules-editor" />,
}));

vi.mock('./PreviewBar', () => ({
  default: () => <div data-testid="dock-preview-bar" />,
}));

const mappings: Mapping[] = [];
const sources: MapperSource[] = [{ id: 's1', label: 'Source', sampleData: {} }];
const parseErrors: ParseError[] = [];

function renderDock(mode: 'code' | 'preview' | 'table' | 'rules') {
  return render(
    <BottomUtilityDock
      mode={mode}
      mappings={mappings}
      sources={sources}
      activeSourceId="s1"
      targetSampleData={{}}
      debugMode={false}
      traceByMappingId={null}
      selectedMappingId={null}
      onRemoveMapping={vi.fn()}
      onSelectMapping={vi.fn()}
      validationDslText=""
      onValidationCodeChange={vi.fn()}
      validationParseErrors={parseErrors}
      validationSamplePaths={[]}
    />,
  );
}

describe('BottomUtilityDock', () => {
  it('renders CodeView when mode is code', () => {
    renderDock('code');
    expect(screen.getByTestId('dock-code-view')).toBeInTheDocument();
    expect(document.querySelector('.dm-bottom-utility-dock--code')).toBeTruthy();
  });

  it('renders MappingTableView when mode is table', () => {
    renderDock('table');
    expect(screen.getByTestId('dock-table-view')).toBeInTheDocument();
    expect(document.querySelector('.dm-bottom-utility-dock--table')).toBeTruthy();
  });

  it('renders ValidationCodeEditor when mode is rules', () => {
    renderDock('rules');
    expect(screen.getByTestId('dock-rules-editor')).toBeInTheDocument();
    expect(document.querySelector('.dm-bottom-utility-dock--rules')).toBeTruthy();
  });

  it('renders PreviewBar when mode is preview', () => {
    renderDock('preview');
    expect(screen.getByTestId('dock-preview-bar')).toBeInTheDocument();
    expect(document.querySelector('.dm-bottom-utility-dock--preview')).toBeTruthy();
  });
});
