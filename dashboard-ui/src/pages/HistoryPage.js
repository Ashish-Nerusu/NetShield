import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

function HistoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ticker, setTicker] = useState([]);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await axios.get('http://localhost:9091/api/netshield/history');
        const data = res.data || [];
        setRows(data);
        const last = data.slice(-5).reverse();
        setTicker(last);
        setCurrent(data.length ? data[data.length - 1] : null);
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
      <h2>Threat Intelligence</h2>
      <div className="ticker">
        <AnimatePresence initial={false}>
          {ticker.map((t) => (
            <motion.div
              key={t.id}
              className={`tick ${t.result === 'Attack' ? 'alert' : 'safe'}`}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span>{new Date(t.timestamp).toLocaleTimeString()}</span>
              <span>{t.filename}</span>
              <span>{t.result}</span>
              <span>{Math.round((t.confidence || 0) * 100)}%</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="intel-grid">
        <div className="gauge-card">
          <h3>Severity Gauge</h3>
          {current && (
            <RadialBarChart
              width={240}
              height={240}
              cx={120}
              cy={120}
              innerRadius={60}
              outerRadius={110}
              barSize={18}
              data={[{ name: 'score', value: Math.round((current.confidence || 0) * 100) }]}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                minAngle={15}
                background
                clockWise
                dataKey="value"
                fill={current.result === 'Attack' ? '#f85149' : '#3fb950'}
              />
            </RadialBarChart>
          )}
          <div className="gauge-label">
            <div className={`badge ${current && current.result === 'Attack' ? 'alert' : 'safe'}`}>
              {current ? current.result : '—'}
            </div>
            <div className="score">{current ? Math.round((current.confidence || 0) * 100) : 0}%</div>
          </div>
        </div>

        <div className="map-card">
          <h3>Global Pulse</h3>
          <div className="map-overlay">
            <div className="dot d1"></div>
            <div className="dot d2"></div>
            <div className="dot d3"></div>
            <div className="dot d4"></div>
          </div>
        </div>

        <div className="badge-card">
          <h3>Active Models</h3>
          <div className="badges">
            <span className="chip glow">CNN-Hybrid</span>
            <span className="chip glow">Random Forest</span>
            <span className="chip glow">XGBoost</span>
          </div>
        </div>
      </div>

      <div className="table-card">
        {loading && <p>Loading...</p>}
        {!loading && (
          <table>
            <thead>
              <tr><th>Time</th><th>Filename</th><th>Result</th><th>Confidence</th></tr>
            </thead>
            <tbody>
              {rows.slice().reverse().map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.timestamp).toLocaleString()}</td>
                  <td>{r.filename}</td>
                  <td className={r.result === 'Attack' ? 'alert' : 'safe'}>{r.result}</td>
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
