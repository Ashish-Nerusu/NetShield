import React from 'react';
import './MetricCard.css';

function MetricCard({ title, value, icon: Icon, trend, trendLabel, colorClass = 'primary' }) {
  return (
    <div className={`metric-card border-${colorClass}`}>
      <div className="metric-header">
        <h3 className="metric-title">{title}</h3>
        {Icon && <div className={`metric-icon text-${colorClass}`}><Icon size={20} /></div>}
      </div>
      <div className="metric-body">
        <div className="metric-value">{value}</div>
      </div>
      {(trend || trendLabel) && (
        <div className="metric-footer">
          {trend && (
            <span className={`metric-trend ${trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-neutral'}`}>
              {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
            </span>
          )}
          {trendLabel && <span className="metric-trend-label">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

export default MetricCard;
