/* ───────────────────────────────────────────────
   ModelComparisonPanel — Metrics table + radar chart
   ─────────────────────────────────────────────── */

import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { BacktestMetrics } from '../types';
import { MODEL_COLORS, MODEL_LABELS } from '../data/mockData';

interface ModelComparisonPanelProps {
  metrics: BacktestMetrics[];
}

export const ModelComparisonPanel: React.FC<ModelComparisonPanelProps> = ({ metrics }) => {
  // Find best model (highest R²)
  const bestModel = metrics.reduce((best, m) =>
    m.r2 > best.r2 ? m : best, metrics[0]
  );

  // Build radar data — normalize each metric to 0-100 scale
  const maxMAE = Math.max(...metrics.map((m) => m.mae));
  const maxRMSE = Math.max(...metrics.map((m) => m.rmse));

  const radarData = [
    {
      metric: 'R² Score',
      ...Object.fromEntries(metrics.map((m) => [m.model_name, m.r2 * 100])),
    },
    {
      metric: 'Dir. Accuracy',
      ...Object.fromEntries(metrics.map((m) => [m.model_name, m.directional_accuracy * 100])),
    },
    {
      metric: 'Low MAE',
      ...Object.fromEntries(metrics.map((m) => [m.model_name, (1 - m.mae / maxMAE) * 100])),
    },
    {
      metric: 'Low RMSE',
      ...Object.fromEntries(metrics.map((m) => [m.model_name, (1 - m.rmse / maxRMSE) * 100])),
    },
    {
      metric: 'Features',
      ...Object.fromEntries(metrics.map((m) => [m.model_name, Math.min(m.n_features * 6, 100)])),
    },
  ];

  return (
    <div className="model-comparison" id="model-comparison">
      {/* Metrics Table */}
      <div className="glass-card model-comparison__table-card">
        <h2 className="section-title">Model Comparison</h2>
        <div className="table-container">
          <table className="metrics-table" id="metrics-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>MAE</th>
                <th>RMSE</th>
                <th>R²</th>
                <th>Dir. Accuracy</th>
                <th>Features</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr
                  key={m.model_name}
                  className={m.model_name === bestModel.model_name ? 'metrics-table__best' : ''}
                >
                  <td>
                    <span className="model-dot" style={{ background: MODEL_COLORS[m.model_name] }} />
                    {MODEL_LABELS[m.model_name] || m.model_name}
                    {m.model_name === bestModel.model_name && (
                      <span className="badge badge--gold">Best</span>
                    )}
                  </td>
                  <td>{m.mae.toFixed(4)}</td>
                  <td>{m.rmse.toFixed(4)}</td>
                  <td className="metrics-table__r2">{m.r2.toFixed(4)}</td>
                  <td>
                    <div className="accuracy-bar">
                      <div
                        className="accuracy-bar__fill"
                        style={{
                          width: `${m.directional_accuracy * 100}%`,
                          background: MODEL_COLORS[m.model_name],
                        }}
                      />
                      <span className="accuracy-bar__label">
                        {(m.directional_accuracy * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td>{m.n_features}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="glass-card model-comparison__radar-card">
        <h2 className="section-title">Performance Radar</h2>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickCount={5}
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
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            {metrics
              .filter((m) => m.model_name !== 'sentiment_only')
              .map((m) => (
                <Radar
                  key={m.model_name}
                  name={MODEL_LABELS[m.model_name] || m.model_name}
                  dataKey={m.model_name}
                  stroke={MODEL_COLORS[m.model_name]}
                  fill={MODEL_COLORS[m.model_name]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
