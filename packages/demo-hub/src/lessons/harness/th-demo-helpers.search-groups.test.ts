/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest';
import { findSearchMatchScenarioGroups } from './th-demo-helpers';

describe('findSearchMatchScenarioGroups', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns scenario bodies that contain search-match tests', () => {
    document.body.innerHTML = `
      <div data-testid="har-scenario-card">
        <div data-testid="har-scenario-header">User Endpoints</div>
        <div class="scenario-group-body">
          <div class="test-card search-match" data-testid="har-test-card">a</div>
          <div class="test-card search-match" data-testid="har-test-card">b</div>
          <div class="test-card search-match" data-testid="har-test-card">c</div>
        </div>
      </div>
      <div data-testid="har-scenario-card">
        <div data-testid="har-scenario-header">Admin Operations</div>
        <div class="scenario-group-body">
          <div class="test-card search-match" data-testid="har-test-card">d</div>
          <div class="test-card search-match" data-testid="har-test-card">e</div>
        </div>
      </div>
      <div data-testid="har-scenario-card">
        <div data-testid="har-scenario-header">No Matches</div>
        <div class="scenario-group-body">
          <div class="test-card" data-testid="har-test-card">f</div>
        </div>
      </div>
    `;

    const groups = findSearchMatchScenarioGroups();
    expect(groups).toHaveLength(2);
    expect(groups[0].classList.contains('scenario-group-body')).toBe(true);
    expect(groups[0].querySelectorAll('.search-match')).toHaveLength(3);
    expect(groups[1].querySelectorAll('.search-match')).toHaveLength(2);
  });

  it('falls back to the scenario card when body is missing', () => {
    document.body.innerHTML = `
      <div data-testid="har-scenario-card">
        <div class="test-card search-match" data-testid="har-test-card">only</div>
      </div>
    `;

    const groups = findSearchMatchScenarioGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].getAttribute('data-testid')).toBe('har-scenario-card');
  });
});
