import type { AllocationSummary } from '@engine/allocationEngine';

interface ExecutionPlanPreviewProps {
  allocation: AllocationSummary;
  concurrency: number;
}

export default function ExecutionPlanPreview({ allocation, concurrency }: ExecutionPlanPreviewProps) {
  if (allocation.items.length === 0) return null;

  const { items, totalRequests, kind } = allocation;

  return (
    <div className="runner-expansion-summary" data-testid="har-exec-plan">
      <div className="runner-expansion-title">Execution Plan</div>

      {kind === 'standard' ? (
        <div className="runner-expansion-row">
          <span>{items[0].iterations} iteration{items[0].iterations !== 1 ? 's' : ''} × {items.length} test{items.length !== 1 ? 's' : ''}</span>
          <span className="runner-expansion-calc">= {totalRequests} requests</span>
        </div>
      ) : (
        <>
          {items.map((item) => (
            <div key={item.testId} className="runner-expansion-row">
              <span>
                {item.testName}
                {item.rowCount > 0 && <span className="count-badge count-badge-data" style={{ marginLeft: 6 }}>{item.rowCount} rows</span>}
              </span>
              <span className="runner-expansion-calc">
                {item.rowCount > 0
                  ? `${item.iterations} × ${item.rowCount} = ${item.totalRequests}`
                  : `${item.iterations} × 1 = ${item.totalRequests}`
                }
              </span>
            </div>
          ))}
        </>
      )}

      <div className="runner-expansion-total">
        Total: {totalRequests} request{totalRequests !== 1 ? 's' : ''}
        {concurrency > 1 && ` · Concurrency: ${concurrency}`}
      </div>
    </div>
  );
}
