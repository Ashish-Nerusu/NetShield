import React, { useEffect, useState } from 'react';
import { api } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

function HistoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ticker, setTicker] = useState([]);
  const [current, setCurrent] = useState(null);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [res, metricsRes] = await Promise.all([
          api.get(`/api/netshield/history`),
          api.get(`/api/netshield/metrics`)
        ]);
        const data = res.data || [];
        setRows(data);
        const last = data.slice(-5).reverse();
        setTicker(last);
        setCurrent(data.length ? data[data.length - 1] : null);
        setMetrics(metricsRes.data);
      } finally {
        setLoading(false);
      }
    };
    run();
    const id = setInterval(run, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)' }}>Threat Intelligence</h2>
      <div className="ticker">
        <AnimatePresence initial={false}>
          {ticker.map((t) => (
            <motion.div
              key={t.eventUuid || t.id}
              className={`tick ${t.attackType !== 'Normal' && t.attackType !== 'Safe' ? 'alert' : 'safe'}`}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span>{new Date(t.timestamp).toLocaleTimeString()}</span>
              <span>{t.sourceModule}</span>
              <span>{t.filename}</span>
              <span>{t.attackType}</span>
              <span>{Math.round((t.confidence || 0) * 100)}%</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="intel-grid">
        <div className="card">
          <h3 style={{ marginTop: 0, color: 'var(--color-text-primary)' }}>Severity Gauge</h3>
          <RadialBarChart
            width={240}
            height={240}
            cx={120}
            cy={120}
            innerRadius={60}
            outerRadius={110}
            barSize={18}
            data={[{ name: 'score', value: metrics ? Math.round((metrics.averageConfidence || 0) * 100) : 0 }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              minAngle={15}
              background
              clockWise
              dataKey="value"
              fill={
                !metrics || metrics.overallSeverity === 'Safe' ? '#3fb950' : 
                metrics.overallSeverity === 'Medium' ? '#d29922' : 
                metrics.overallSeverity === 'High' ? '#f0883e' : '#f85149'
              }
            />
          </RadialBarChart>
          <div className="gauge-label">
            <div className={`badge ${
                !metrics || metrics.overallSeverity === 'Safe' ? 'badge-success' : 
                metrics.overallSeverity === 'Medium' ? 'badge-warning' : 'badge-danger'
              }`}>
              {metrics ? metrics.overallSeverity || 'Safe' : 'Safe'}
            </div>
            <div className="score" style={{ color: 'var(--color-text-primary)' }}>
              {metrics ? Math.round((metrics.averageConfidence || 0) * 100) : 0}%
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, color: 'var(--color-text-primary)' }}>Global Pulse</h3>
          <div className="map-overlay">
            <div className="dot d1"></div>
            <div className="dot d2"></div>
            <div className="dot d3"></div>
            <div className="dot d4"></div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, color: 'var(--color-text-primary)' }}>Active Models</h3>
          <div className="badges">
            {metrics && metrics.activeModels && Object.keys(metrics.activeModels).length > 0 ? (
              Object.keys(metrics.activeModels).map((model) => (
                <span key={model} className="chip">{model}</span>
              ))
            ) : (
              <>
                <span className="chip">CNN-Hybrid</span>
                <span className="chip">Random Forest</span>
                <span className="chip">XGBoost</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card table-container">
        {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>}
        {!loading && (
          <table className="table">
            <thead>
              <tr><th>Time</th><th>Source</th><th>Filename</th><th>Result</th><th>Severity</th><th>Confidence</th></tr>
            </thead>
            <tbody>
              {rows.slice().reverse().map((r) => (
                <tr key={r.eventUuid || r.id}>
                  <td>{new Date(r.timestamp).toLocaleString()}</td>
                  <td>{r.sourceModule}</td>
                  <td>{r.filename}</td>
                  <td><span className={`badge ${r.attackType !== 'Normal' && r.attackType !== 'Safe' ? 'badge-danger' : 'badge-success'}`}>{r.attackType}</span></td>
                  <td>{r.severity}</td>
                  <td>{Math.round((r.confidence || 0) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
