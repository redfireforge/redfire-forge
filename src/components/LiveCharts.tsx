import type { TimeSeriesPoint } from '../hooks/useTestExecution';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const chartTooltipStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.78rem',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtMs = (v: any) => [`${v} ms`, 'Avg'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTps = (v: any) => [`${v}`, 'TPS'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtErr = (v: any) => [`${v}%`, 'Errors'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtConc = (v: any) => [`${v}`, 'In-Flight'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtLabel = (l: any) => `${l}s`;

export function LiveCharts({ data, isTimeBased: _isTimeBased }: { data: TimeSeriesPoint[]; isTimeBased: boolean }) {
  return (
    <div className="live-charts">
      <div className="live-chart-card">
        <div className="live-chart-title">Response Time (ms)</div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradResp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3498db" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3498db" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="elapsedSec" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: number) => `${v}s`} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={45} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={fmtMs} labelFormatter={fmtLabel} />
            <Area type="monotone" dataKey="avgResponseTime" stroke="#3498db" fill="url(#gradResp)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="live-chart-card">
        <div className="live-chart-title">Throughput (TPS)</div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradTps" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#27ae60" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#27ae60" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="elapsedSec" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: number) => `${v}s`} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={45} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={fmtTps} labelFormatter={fmtLabel} />
            <Area type="monotone" dataKey="tps" stroke="#27ae60" fill="url(#gradTps)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="live-chart-card">
        <div className="live-chart-title">Error Rate (%)</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="elapsedSec" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: number) => `${v}s`} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={45} domain={[0, 'auto']} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={fmtErr} labelFormatter={fmtLabel} />
            <Line type="monotone" dataKey="errorRate" stroke="#e74c3c" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {data.some((d) => d.concurrency > 0) && (
        <div className="live-chart-card">
          <div className="live-chart-title">Concurrency</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradConc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9b59b6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#9b59b6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="elapsedSec" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: number) => `${v}s`} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={45} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={fmtConc} labelFormatter={fmtLabel} />
              <Area type="stepAfter" dataKey="concurrency" stroke="#9b59b6" fill="url(#gradConc)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
