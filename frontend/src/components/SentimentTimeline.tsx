/* ───────────────────────────────────────────────
   SentimentTimeline — Sentiment over time chart
   VADER + FinBERT lines with source toggles
   ─────────────────────────────────────────────── */

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import type { SentimentDataPoint } from '../types';

interface SentimentTimelineProps {
  data: SentimentDataPoint[];
}

const SOURCE_COLORS: Record<string, string> = {
  twitter: '#1da1f2',
  reddit: '#ff4500',
  news: '#22c55e',
};

const SOURCE_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  reddit: 'Reddit',
  news: 'News',
};

export const SentimentTimeline: React.FC<SentimentTimelineProps> = ({ data }) => {
  const [activeSource, setActiveSource] = useState<string>('all');
  const [metric, setMetric] = useState<'vader_score' | 'finbert_score'>('vader_score');

  const sources = useMemo(
    () => [...new Set(data.map((d) => d.source))],
    [data]
  );

  // Aggregate by date
  const chartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};

    for (const d of data) {
      if (!byDate[d.date]) byDate[d.date] = {};
      byDate[d.date][`${d.source}_vader`] = d.vader_score;
      byDate[d.date][`${d.source}_finbert`] = d.finbert_score;
      byDate[d.date][`${d.source}_count`] = d.doc_count;
    }

    // Compute average across sources for each date
    return Object.entries(byDate)
      .map(([date, scores]) => {
        const vaderValues = sources.map((s) => scores[`${s}_vader`] || 0);
        const finbertValues = sources.map((s) => scores[`${s}_finbert`] || 0);

        return {
          date,
          ...scores,
          avg_vader: vaderValues.reduce((a, b) => a + b, 0) / vaderValues.length,
          avg_finbert: finbertValues.reduce((a, b) => a + b, 0) / finbertValues.length,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data, sources]);

  const metricLabel = metric === 'vader_score' ? 'VADER' : 'FinBERT';

  return (
    <div className="sentiment-timeline glass-card" id="sentiment-timeline">
      <div className="sentiment-timeline__header">
        <h2 className="section-title">Sentiment Timeline</h2>

        <div className="sentiment-timeline__controls">
          {/* Metric toggle */}
          <div className="toggle-group">
            <button
              className={`toggle-btn ${metric === 'vader_score' ? 'toggle-btn--active' : ''}`}
              onClick={() => setMetric('vader_score')}
            >
              VADER
            </button>
            <button
              className={`toggle-btn ${metric === 'finbert_score' ? 'toggle-btn--active' : ''}`}
              onClick={() => setMetric('finbert_score')}
            >
              FinBERT
            </button>
          </div>

          {/* Source filter */}
          <div className="toggle-group">
            <button
              className={`toggle-btn ${activeSource === 'all' ? 'toggle-btn--active' : ''}`}
              onClick={() => setActiveSource('all')}
            >
              All
            </button>
            {sources.map((s) => (
              <button
                key={s}
                className={`toggle-btn ${activeSource === s ? 'toggle-btn--active' : ''}`}
                onClick={() => setActiveSource(s)}
                style={activeSource === s ? { borderColor: SOURCE_COLORS[s] } : {}}
              >
                {SOURCE_LABELS[s] || s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
          <defs>
            <linearGradient id="sentPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />

          <XAxis
            dataKey="date"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickFormatter={(v) => v.slice(5)}
          />

          <YAxis
            domain={[-0.6, 0.6]}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          />

          <Tooltip
            contentStyle={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />

          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" label="" />

          {activeSource === 'all' ? (
            <>
              <Area
                type="monotone"
                dataKey={`avg_${metric === 'vader_score' ? 'vader' : 'finbert'}`}
                name={`Avg ${metricLabel}`}
                stroke="#00d4aa"
                fill="url(#sentPositive)"
                strokeWidth={2}
                dot={false}
              />
              {sources.map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={`${s}_${metric === 'vader_score' ? 'vader' : 'finbert'}`}
                  name={`${SOURCE_LABELS[s]} ${metricLabel}`}
                  stroke={SOURCE_COLORS[s]}
                  strokeWidth={1.5}
                  dot={false}
                  opacity={0.7}
                />
              ))}
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey={`${activeSource}_vader`}
                name={`${SOURCE_LABELS[activeSource]} VADER`}
                stroke="#00d4aa"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey={`${activeSource}_finbert`}
                name={`${SOURCE_LABELS[activeSource]} FinBERT`}
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
