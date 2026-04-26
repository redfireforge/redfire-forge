import { useState, useCallback } from 'react';
import type { FeatureGroup, TestScenario, Scenario } from '../../../shared/types';

interface UseScenarioDragDropParams {
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
}

export function useScenarioDragDrop({
  setFeatureGroups,
}: UseScenarioDragDropParams) {
  const [dragScenario, setDragScenario] = useState<{ scenarioId: string; fromFeatureId: string } | null>(null);
  const [dragTest, setDragTest] = useState<{ testId: string; fromFeatureId: string; fromScenarioId: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ type: 'scenario' | 'test'; featureId: string; scenarioId?: string; position?: 'before' | 'after'; targetId?: string } | null>(null);

  const moveScenario = useCallback((scenarioId: string, fromFgId: string, toFgId: string, beforeScId?: string) => {
    if (fromFgId === toFgId && !beforeScId) return;
    setFeatureGroups((prev) => {
      let scenario: TestScenario | undefined;
      const without = prev.map((fg) => {
        if (fg.id !== fromFgId) return fg;
        scenario = fg.scenarios.find((sc) => sc.id === scenarioId);
        return { ...fg, scenarios: fg.scenarios.filter((sc) => sc.id !== scenarioId) };
      });
      if (!scenario) return prev;
      return without.map((fg) => {
        if (fg.id !== toFgId) return fg;
        const scenarios = fg.scenarios.filter((sc) => sc.id !== scenarioId);
        if (beforeScId) {
          const idx = scenarios.findIndex((sc) => sc.id === beforeScId);
          if (idx >= 0) { scenarios.splice(idx, 0, scenario!); return { ...fg, scenarios }; }
        }
        scenarios.push(scenario!);
        return { ...fg, scenarios };
      });
    });
  }, [setFeatureGroups]);

  const moveTest = useCallback((testId: string, fromFgId: string, fromScId: string, toFgId: string, toScId: string, beforeTestId?: string) => {
    if (fromFgId === toFgId && fromScId === toScId && !beforeTestId) return;
    setFeatureGroups((prev) => {
      let test: Scenario | undefined;
      const without = prev.map((fg) => {
        if (fg.id !== fromFgId) return fg;
        return {
          ...fg,
          scenarios: fg.scenarios.map((sc) => {
            if (sc.id !== fromScId) return sc;
            test = sc.tests.find((t) => t.id === testId);
            return { ...sc, tests: sc.tests.filter((t) => t.id !== testId) };
          }),
        };
      });
      if (!test) return prev;
      return without.map((fg) => {
        if (fg.id !== toFgId) return fg;
        return {
          ...fg,
          scenarios: fg.scenarios.map((sc) => {
            if (sc.id !== toScId) return sc;
            const tests = sc.tests.filter((t) => t.id !== testId);
            if (beforeTestId) {
              const idx = tests.findIndex((t) => t.id === beforeTestId);
              if (idx >= 0) { tests.splice(idx, 0, test!); return { ...sc, tests }; }
            }
            tests.push(test!);
            return { ...sc, tests };
          }),
        };
      });
    });
  }, [setFeatureGroups]);

  const handleDragEnd = useCallback(() => {
    if (dragScenario && dropTarget?.type === 'scenario') {
      moveScenario(dragScenario.scenarioId, dragScenario.fromFeatureId, dropTarget.featureId, dropTarget.targetId);
    }
    if (dragTest && dropTarget?.type === 'test' && dropTarget.scenarioId) {
      moveTest(dragTest.testId, dragTest.fromFeatureId, dragTest.fromScenarioId, dropTarget.featureId, dropTarget.scenarioId, dropTarget.targetId);
    }
    setDragScenario(null);
    setDragTest(null);
    setDropTarget(null);
  }, [dragScenario, dragTest, dropTarget, moveScenario, moveTest]);

  return {
    dragScenario, setDragScenario,
    dragTest, setDragTest,
    dropTarget, setDropTarget,
    moveScenario,
    moveTest,
    handleDragEnd,
  };
}
