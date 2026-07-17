/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import VersionDiffViewerSection from './VersionDiffViewerSection';

vi.mock('json-diff-kit', () => ({
  Viewer: ({ diff }: { diff: unknown }) => <div data-testid="diff-viewer">{JSON.stringify(diff)}</div>,
}));

afterEach(() => cleanup());

const DIFF: readonly [unknown[], unknown[]] = [[{ type: 'modify' }], []];

describe('VersionDiffViewerSection', () => {
  it('prompts when both sides select the same version', () => {
    render(
      <VersionDiffViewerSection
        compareLeft="v1"
        compareRight="v1"
        diffResult={DIFF}
        diffViewerRef={createRef()}
      />,
    );
    expect(screen.getByText('Select different versions on each side to compare.')).toBeInTheDocument();
  });

  it('renders diff viewer when a result is available', () => {
    render(
      <VersionDiffViewerSection
        compareLeft="v1"
        compareRight="v2"
        diffResult={DIFF}
        diffViewerRef={createRef()}
      />,
    );
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('prefers activeDiffResult over diffResult', () => {
    const alt: readonly [unknown[], unknown[]] = [[{ type: 'add' }], []];
    render(
      <VersionDiffViewerSection
        compareLeft="v1"
        compareRight="v2"
        diffResult={DIFF}
        activeDiffResult={alt}
        diffViewerRef={createRef()}
      />,
    );
    expect(screen.getByTestId('diff-viewer').textContent).toContain('add');
  });

  it('shows no-differences message when versions differ but result is null', () => {
    render(
      <VersionDiffViewerSection
        compareLeft="v1"
        compareRight="v2"
        diffResult={null}
        diffViewerRef={createRef()}
      />,
    );
    expect(screen.getByText('No differences found.')).toBeInTheDocument();
  });

  it('prompts to select two versions when sides are incomplete', () => {
    render(
      <VersionDiffViewerSection
        compareLeft={null}
        compareRight="v2"
        diffResult={null}
        diffViewerRef={createRef()}
      />,
    );
    expect(screen.getByText('Select two versions above to compare.')).toBeInTheDocument();
  });

  it('renders children above the viewer', () => {
    render(
      <VersionDiffViewerSection
        compareLeft="v1"
        compareRight="v2"
        diffResult={DIFF}
        diffViewerRef={createRef()}
      >
        <div data-testid="child-slot">Tabs</div>
      </VersionDiffViewerSection>,
    );
    expect(screen.getByTestId('child-slot')).toBeInTheDocument();
  });
});
