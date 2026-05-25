/* ───────────────────────────────────────────────
   LiveChart — Main price + sentiment chart
   Recharts ComposedChart with dual Y-axis
   ─────────────────────────────────────────────── */

import React, { useState, useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { PriceDataPoint, TimeRange } from '../types';
import { MODEL_COLORS, MODEL_LABELS } from '../data/mockData';

interface LiveChartProps {
  data: PriceDataPoint[];
  visibleModels?: string[];
}

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: 'All', value: 'ALL' },
];

function filterByRange(data: PriceDataPoint[], range: TimeRange): PriceDataPoint[] {
  const now = new Date();
  const daysMap: Record<TimeRange, number> = {
    '1W': 7, '1M': 30, '3M': 90, '6M': 180, 'ALL': 9999,
  };
  const cutoff = new Date(now.getTime() - daysMap[range] * 86400000);

  return data.filter((d) => new Date(d.date) >= cutoff);
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="chart-tooltip__row" style={{ color: entry.color }}>
          <span className="chart-tooltip__label">{entry.name}:</span>
          <span className="chart-tooltip__value">
            {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
};

export const LiveChart: React.FC<LiveChartProps> = ({
  data,
  visibleModels = ['random_forest', 'extra_trees'],
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');

  const filteredData = useMemo(
    () => filterByRange(data, timeRange),
    [data, timeRange]
  );

  // Flatten predictions into chart-friendly format
  const chartData = useMemo(() =>
    filteredData.map((d) => ({
      date: d.date,
      close: d.close,
      volume: d.volume,
      sentiment: d.sentiment,
      ...Object.fromEntries(
        Object.entries(d.predictions || {}).map(([k, v]) => [`pred_${k}`, v])
      ),
    })),
    [filteredData]
  );

  // Compute price domain with padding
  const priceValues = chartData.flatMap((d) => [d.close, ...Object.entries(d).filter(([k]) => k.startsWith('pred_')).map(([, v]) => v as number)]).filter(Boolean);
  const minPrice = Math.floor(Math.min(...priceValues) - 10);
  const maxPrice = Math.ceil(Math.max(...priceValues) + 10);

  return (
    <div className="live-chart glass-card" id="live-chart">
      <div className="live-chart__header">
        <h2 className="live-chart__title">XAUUSD Price & Predictions</h2>
        <div className="time-range-selector">
          {TIME_RANGES.map(({ label, value }) => (
            <button
              key={value}
              className={`time-range-btn ${timeRange === value ? 'time-range-btn--active' : ''}`}
              onClick={() => setTimeRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="live-chart__container">
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />

            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickFormatter={(v) => v.slice(5)} /* MM-DD */
            />

            <YAxis
              yAxisId="price"
              orientation="left"
              domain={[minPrice, maxPrice]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickFormatter={(v) => `$${v}`}
            />

            <YAxis
              yAxisId="sentiment"
              orientation="right"
              domain={[-0.5, 0.5]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />

            <YAxis yAxisId="volume" orientation="right" hide domain={[0, 'auto']} />

            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
              iconType="circle"
              iconSize={8}
            />

            {/* Volume bars */}
            <Bar
              yAxisId="volume"
              dataKey="volume"
              name="Volume"
              fill="url(#volumeGradient)"
              opacity={0.3}
              barSize={4}
            />

            {/* Price area */}
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="close"
              name="Close Price"
              stroke="#00d4aa"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />

            {/* Sentiment line */}
            <Line
              yAxisId="sentiment"
              type="monotone"
              dataKey="sentiment"
              name="Sentiment"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />

            {/* Model prediction lines */}
            {visibleModels.map((model) => (
              <Line
                key={model}
                yAxisId="price"
                type="monotone"
                dataKey={`pred_${model}`}
                name={MODEL_LABELS[model] || model}
                stroke={MODEL_COLORS[model] || '#999'}
                strokeWidth={1.5}
                dot={false}
                opacity={0.8}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
