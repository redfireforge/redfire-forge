/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '@test-utils/customSelectHelper';
import { GalleryFilters } from './GalleryFilters';
import { defaultFilterState, apiHostname, type GalleryFilterState } from './galleryFiltersUtils';
import { GalleryDomainConfig } from '../../../data/galleries/registry';
import { TrainingPath } from '../../../data/galleries/trainingPaths';

const domains: GalleryDomainConfig[] = [
  { key: 'requests', label: 'Requests', icon: '⚡', description: 'R' },
];

const trainingPaths: TrainingPath[] = [
  {
    id: 'p1',
    name: 'Path One',
    icon: '📘',
    description: 'D',
    phases: [{ id: 1, name: 'Ph', manuals: [{ title: 'M', description: '', difficulty: 'easy', manualPath: 'm.html' }] }],
  },
  {
    id: 'empty-phases',
    name: 'Empty path',
    icon: '○',
    description: 'E',
    phases: [{ id: 1, name: 'Ph', manuals: [] }],
  },
  {
    id: 'soon',
    name: 'Later',
    icon: '⏳',
    description: 'Soon',
    comingSoon: true,
    phases: [{ id: 1, name: 'Ph', manuals: [] }],
  },
];

describe('defaultFilterState / apiHostname', () => {
  it('defaultFilterState returns empty filter shape', () => {
    expect(defaultFilterState()).toEqual({
      domain: 'all',
      category: '',
      difficulty: 'all',
      liveApi: '',
      tag: '',
      search: '',
    });
  });

  it('apiHostname parses valid URLs', () => {
    expect(apiHostname('https://api.example.com/v1')).toBe('api.example.com');
  });

  it('apiHostname returns original string on invalid URL', () => {
    expect(apiHostname('not a url')).toBe('not a url');
  });

  it('apiHostname returns original string when URL parses with empty hostname', () => {
    expect(apiHostname('localhost:3001')).toBe('localhost:3001');
  });
});

describe('GalleryFilters', () => {
  it('calls handleDomainClick: updates domain, clears tag, switches to samples', () => {
    const onChange = vi.fn();
    const onModeChange = vi.fn();
    const value = defaultFilterState();
    value.tag = 'smoke';
    render(
      <GalleryFilters
        domains={domains}
        categories={['cat-a']}
        liveApis={['h.example.com']}
        tags={['smoke', 'edge']}
        value={value}
        onChange={onChange}
        mode="paths"
        onModeChange={onModeChange}
        trainingPaths={trainingPaths}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /All/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ domain: 'all', tag: '' }));
    expect(onModeChange).toHaveBeenCalledWith('samples');
  });

  it('activates a concrete domain tab', () => {
    const onChange = vi.fn();
    const onModeChange = vi.fn();
    render(
      <GalleryFilters
        domains={domains}
        categories={[]}
        liveApis={[]}
        tags={[]}
        value={defaultFilterState()}
        onChange={onChange}
        mode="samples"
        onModeChange={onModeChange}
        trainingPaths={trainingPaths}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Requests/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ domain: 'requests' }));
  });

  it('marks domain active only in samples mode', () => {
    const onChange = vi.fn();
    const onModeChange = vi.fn();
    const value = { ...defaultFilterState(), domain: 'requests' as const };
    const { container } = render(
      <GalleryFilters
        domains={domains}
        categories={[]}
        liveApis={[]}
        tags={[]}
        value={value}
        onChange={onChange}
        mode="paths"
        onModeChange={onModeChange}
        trainingPaths={trainingPaths}
      />,
    );
    const active = container.querySelector('.gallery-domain-btn.active');
    expect(active).toBeNull();
  });

  it('handles training path click and shows coming soon label', () => {
    const onModeChange = vi.fn();
    const onSelectPath = vi.fn();
    render(
      <GalleryFilters
        domains={domains}
        categories={[]}
        liveApis={[]}
        tags={[]}
        value={defaultFilterState()}
        onChange={vi.fn()}
        mode="samples"
        onModeChange={onModeChange}
        trainingPaths={trainingPaths}
        onSelectPath={onSelectPath}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Path One/i }));
    expect(onSelectPath).toHaveBeenCalledWith('p1');
    expect(onModeChange).toHaveBeenCalledWith('paths');
    expect(screen.getByText('soon')).toBeTruthy();
  });

  it('dims filter controls in paths mode', () => {
    const { container } = render(
      <GalleryFilters
        domains={domains}
        categories={['c']}
        liveApis={['host']}
        tags={['t1']}
        value={defaultFilterState()}
        onChange={vi.fn()}
        mode="paths"
        onModeChange={vi.fn()}
        trainingPaths={trainingPaths}
      />,
    );
    expect(container.querySelector('.gallery-filter-controls-dimmed')).toBeTruthy();
  });

  it('updates category and difficulty selects', () => {
    const onChange = vi.fn();
    render(
      <GalleryFilters
        domains={domains}
        categories={['c1']}
        liveApis={[]}
        tags={[]}
        value={defaultFilterState()}
        onChange={onChange}
        mode="samples"
        onModeChange={vi.fn()}
        trainingPaths={trainingPaths}
      />,
    );
    selectOption(screen.getByLabelText('Filter by category').closest('.cs-wrapper')!, 'c1');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: 'c1' }));
    selectOption(screen.getByLabelText('Filter by difficulty').closest('.cs-wrapper')!, 'Easy');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ difficulty: 'easy' }));
  });

  it('renders live API select when liveApis non-empty', () => {
    const onChange = vi.fn();
    render(
      <GalleryFilters
        domains={domains}
        categories={[]}
        liveApis={['api.test']}
        tags={[]}
        value={{ ...defaultFilterState(), liveApi: 'api.test' }}
        onChange={onChange}
        mode="samples"
        onModeChange={vi.fn()}
        trainingPaths={trainingPaths}
      />,
    );
    selectOption(screen.getByLabelText('Filter by live API').closest('.cs-wrapper')!, 'All APIs');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ liveApi: '' }));
  });

  it('tag combobox filters, selects, toggles off, clears, shows no matches', () => {
    function TagHarness() {
      const [value, setValue] = useState<GalleryFilterState>(defaultFilterState());
      return (
        <GalleryFilters
          domains={domains}
          categories={[]}
          liveApis={[]}
          tags={['alpha', 'beta']}
          value={value}
          onChange={setValue}
          mode="samples"
          onModeChange={vi.fn()}
          trainingPaths={trainingPaths}
        />
      );
    }
    render(<TagHarness />);
    const search = screen.getByLabelText('Search tags');
    fireEvent.change(search, { target: { value: 'alp' } });
    fireEvent.click(screen.getByRole('button', { name: '#alpha' }));
    expect(screen.getByRole('button', { name: 'Clear tag filter' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '#alpha' }));
    fireEvent.change(search, { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: '#alpha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear tag filter' }));
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No matching tags')).toBeTruthy();
  });
});
