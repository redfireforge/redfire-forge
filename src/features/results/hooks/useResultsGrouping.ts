import { useState, useMemo, useEffect } from 'react';
import type { RequestResult } from '../../../shared/types';
import { buildGroups, type GroupByLevel, type GroupNode } from '../../test-runner/utils/resultsGrouping';

export function useResultsGrouping(filteredResults: RequestResult[], _isWorkflowRun: boolean) {
  const [groupBy, setGroupBy] = useState<GroupByLevel>('feature');
  const [subGroupBy, setSubGroupBy] = useState<GroupByLevel>('group');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groupLevels: GroupByLevel[] = useMemo(() => {
    if (groupBy === 'test' && subGroupBy === 'dataRow') return ['test', 'dataRow'];
    if (groupBy === 'test') return ['test'];
    if (groupBy === 'group') return subGroupBy === 'test' ? ['group', 'test'] : ['group'];
    // Workflow grouping options
    if (groupBy === 'iteration') return subGroupBy === 'workflowStep' ? ['iteration', 'workflowStep'] : ['iteration'];
    if (groupBy === 'workflowStep') return subGroupBy === 'iteration' ? ['workflowStep', 'iteration'] : ['workflowStep'];
    // feature
    if (subGroupBy === 'group') return ['feature', 'group'];
    return ['feature', 'test'];
  }, [groupBy, subGroupBy]);

  const isFlat = groupBy === 'test' && subGroupBy !== 'dataRow';

  const groupTree = useMemo(() => {
    if (isFlat) return [] as GroupNode[];
    return buildGroups(filteredResults, groupLevels);
  }, [filteredResults, groupLevels, isFlat]);

  const groupCount = useMemo(() => {
    if (isFlat) return 0;
    return groupTree.reduce((n, g) => n + 1 + g.children.length, 0);
  }, [groupTree, isFlat]);

  useEffect(() => {
    const allKeys: string[] = [];
    if (groupTree.length > 0) {
      const collect = (nodes: GroupNode[], parentKey: string) => {
        for (const g of nodes) {
          const nodeKey = parentKey ? `${parentKey}/${g.key}` : g.key;
          allKeys.push(nodeKey);
          if (g.children.length > 0) collect(g.children, nodeKey);
        }
      };
      collect(groupTree, '');
    }
    setExpanded(new Set(allKeys));
  }, [groupTree]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const subGroupOptions = useMemo((): { value: GroupByLevel; label: string }[] => {
    if (groupBy === 'feature') return [{ value: 'group', label: 'Then by Scenario' }, { value: 'test', label: 'Then by Test Name' }];
    if (groupBy === 'group') return [{ value: 'test', label: 'Then by Test Name' }];
    if (groupBy === 'test') {
      const hasDataRows = filteredResults.some(r => r.dataRowId);
      if (hasDataRows) return [{ value: 'dataRow', label: 'Then by Data Row' }];
    }
    if (groupBy === 'iteration') return [{ value: 'workflowStep', label: 'Then by Step' }];
    if (groupBy === 'workflowStep') return [{ value: 'iteration', label: 'Then by Iteration' }];
    return [];
  }, [groupBy, filteredResults]);

  const handleGroupByChange = (val: GroupByLevel) => {
    setGroupBy(val);
    setExpanded(new Set());
    if (val === 'feature') setSubGroupBy('group');
    else if (val === 'group') setSubGroupBy('test');
    else if (val === 'test') setSubGroupBy('test'); // reset; user can pick dataRow from sub-group
    else if (val === 'iteration') setSubGroupBy('workflowStep');
    else if (val === 'workflowStep') setSubGroupBy('iteration');
  };

  return {
    groupBy,
    subGroupBy,
    setSubGroupBy,
    expanded,
    setExpanded,
    toggle,
    handleGroupByChange,
    groupTree,
    groupCount,
    isFlat,
    subGroupOptions,
  };
}
