import { useState, useCallback } from 'react';
import type { FeatureGroup, TestScenario, Scenario } from '@shared/types';
import {
  logScenarioMovedIn, logScenarioMovedOut,
  logTestMovedIn, logTestMovedOut,
} from '../utils/structureChangeLog';

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
      const fromFg = prev.find(fg => fg.id === fromFgId);
      const toFg = prev.find(fg => fg.id === toFgId);
      const without = prev.map((fg) => {
        if (fg.id !== fromFgId) return fg;
        scenario = fg.scenarios.find((sc) => sc.id === scenarioId);
        const updated = { ...fg, scenarios: fg.scenarios.filter((sc) => sc.id !== scenarioId) };
        return (fromFgId !== toFgId && scenario) ? logScenarioMovedOut(updated, scenario.name, toFg?.name ?? '') : updated;
      });
      if (!scenario) return prev;
      return without.map((fg) => {
        if (fg.id !== toFgId) return fg;
        const scenarios = fg.scenarios.filter((sc) => sc.id !== scenarioId);
        if (beforeScId) {
          const idx = scenarios.findIndex((sc) => sc.id === beforeScId);
          if (idx >= 0) { scenarios.splice(idx, 0, scenario!); }
          else scenarios.push(scenario!);
        } else {
          scenarios.push(scenario!);
        }
        const updated = { ...fg, scenarios };
        return (fromFgId !== toFgId) ? logScenarioMovedIn(updated, scenario!.name, fromFg?.name ?? '') : updated;
      });
    });
  }, [setFeatureGroups]);

  const moveTest = useCallback((testId: string, fromFgId: string, fromScId: string, toFgId: string, toScId: string, beforeTestId?: string) => {
    if (fromFgId === toFgId && fromScId === toScId && !beforeTestId) return;
    setFeatureGroups((prev) => {
      let test: Scenario | undefined;
      const fromFg = prev.find(fg => fg.id === fromFgId);
      const toFg = prev.find(fg => fg.id === toFgId);
      const fromSc = fromFg?.scenarios.find(sc => sc.id === fromScId);
      const toSc = toFg?.scenarios.find(sc => sc.id === toScId);
      const without = prev.map((fg) => {
        if (fg.id !== fromFgId) return fg;
        const updated = {
          ...fg,
          scenarios: fg.scenarios.map((sc) => {
            if (sc.id !== fromScId) return sc;
            test = sc.tests.find((t) => t.id === testId);
            return { ...sc, tests: sc.tests.filter((t) => t.id !== testId) };
          }),
        };
        return (fromFgId !== toFgId && test) ? logTestMovedOut(updated, test.name, fromSc?.name ?? '', toFg?.name ?? '') : updated;
      });
      if (!test) return prev;
      return without.map((fg) => {
        if (fg.id !== toFgId) return fg;
        const updated = {
          ...fg,
          scenarios: fg.scenarios.map((sc) => {
            if (sc.id !== toScId) return sc;
            const tests = sc.tests.filter((t) => t.id !== testId);
            if (beforeTestId) {
              const idx = tests.findIndex((t) => t.id === beforeTestId);
              if (idx >= 0) { tests.splice(idx, 0, test!); }
              else tests.push(test!);
            } else {
              tests.push(test!);
            }
            return { ...sc, tests };
          }),
        };
        return (fromFgId !== toFgId) ? logTestMovedIn(updated, test!.name, toSc?.name ?? '', fromFg?.name ?? '') : updated;
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
