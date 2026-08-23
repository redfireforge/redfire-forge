/* eslint-disable react-refresh/only-export-components -- shared test helpers */
import { useState } from 'react';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import { GrpcCallPanel } from './GrpcCallPanel';

export const ECHO_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!;

export function StatefulGrpcCallPanel({
  initialTab,
  method,
  serviceFullName,
}: {
  initialTab: GrpcStudioTabState;
  method: typeof FIXTURE_DESCRIPTOR.services[0]['methods'][0];
  serviceFullName: string;
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <GrpcCallPanel
      tab={tab}
      method={method}
      serviceFullName={serviceFullName}
      onPatch={(patch) => setTab((current) => ({ ...current, ...patch }))}
    />
  );
}
