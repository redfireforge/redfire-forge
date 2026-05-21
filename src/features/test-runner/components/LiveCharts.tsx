import type { TimeSeriesPoint } from '../hooks/useTestExecution';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.78rem',
};

const TICK_STYLE = { fontSize: 10, fill: 'var(--text-muted)' };
const CHART_MARGIN = { top: 4, right: 8, bottom: 0, left: 0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtLabel = (l: any) => `${l}s`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtRps = (v: any, name: any) => [`${v}`, name === 'targetRps' ? 'Target RPS' : 'Actual RPS'];

function LiveAreaChart({ title, data, dataKey, color, gradientId, formatter, chartType = 'area' }: {
  title: string;
  data: TimeSeriesPoint[];
  dataKey: string;
  color: string;
  gradientId: string;
  formatter: (v: unknown) => [string, string];
  chartType?: 'area' | 'stepArea' | 'line';
}) {
  return (
    <div className="live-chart-card">
      <div className="live-chart-title">{title}</div>
      <ResponsiveContainer width="100%" height={140}>
        {chartType === 'line' ? (
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="elapsedSec" tick={TICK_STYLE} tickFormatter={(v: number) => `${v}s`} />
            <YAxis tick={TICK_STYLE} width={45} domain={[0, 'auto']} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={formatter} labelFormatter={fmtLabel} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        ) : (
          <AreaChart data={data} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="elapsedSec" tick={TICK_STYLE} tickFormatter={(v: number) => `${v}s`} />
            <YAxis tick={TICK_STYLE} width={45} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={formatter} labelFormatter={fmtLabel} />
            <Area type={chartType === 'stepArea' ? 'stepAfter' : 'monotone'} dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtMs = (v: any) => [`${v} ms`, 'Avg'] as [string, string];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTps = (v: any) => [`${v}`, 'TPS'] as [string, string];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtErr = (v: any) => [`${v}%`, 'Errors'] as [string, string];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtConc = (v: any) => [`${v}`, 'In-Flight'] as [string, string];

export function LiveCharts({ data, isTimeBased: _isTimeBased, isArrivalRate = false }: { data: TimeSeriesPoint[]; isTimeBased: boolean; isArrivalRate?: boolean }) {
  return (
    <div className="live-charts">
      <LiveAreaChart title="Response Time (ms)" data={data} dataKey="avgResponseTime" color="#3498db" gradientId="gradResp" formatter={fmtMs} />
      <LiveAreaChart title="Throughput (TPS)" data={data} dataKey="tps" color="#27ae60" gradientId="gradTps" formatter={fmtTps} />
      <LiveAreaChart title="Error Rate (%)" data={data} dataKey="errorRate" color="#e74c3c" gradientId="gradErr" formatter={fmtErr} chartType="line" />

      {isArrivalRate && data.some((d) => d.targetRps !== undefined || d.actualRps !== undefined) && (
        <div className="live-chart-card">
          <div className="live-chart-title">Target vs Actual RPS</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="gradActualRps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e67e22" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#e67e22" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="elapsedSec" tick={TICK_STYLE} tickFormatter={(v: number) => `${v}s`} />
              <YAxis tick={TICK_STYLE} width={45} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={fmtRps} labelFormatter={fmtLabel} />
              <Line type="monotone" dataKey="targetRps" stroke="#e74c3c" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="actualRps" stroke="#e67e22" fill="url(#gradActualRps)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.some((d) => d.concurrency > 0) && (
        <LiveAreaChart title="Concurrency" data={data} dataKey="concurrency" color="#9b59b6" gradientId="gradConc" formatter={fmtConc} chartType="stepArea" />
      )}
    </div>
  );
}
