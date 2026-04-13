import React, { useEffect, useMemo, useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Gauge({ value }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const bg = `conic-gradient(#3fb950 ${pct * 3.6}deg, #1f232b ${pct * 3.6}deg)`;
  return (
    <div className="gauge">
      <div className="gauge-ring" style={{ background: bg }}>
        <div className="gauge-hole">
          <div className="gauge-text">{pct}%</div>
        </div>
      </div>
      <div className="gauge-label">Avg Confidence</div>
    </div>
  );
}

function Profile() {
  const [user, setUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const me = await api.get(`/api/auth/me`);
        setUser(me.data);
      } catch (err) {
        const status = err.response?.status;
        const statusText = err.response?.statusText;
        const body = err.response?.data;
        const bodyText = typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body);
        alert(`Profile load failed:\nHTTP ${status ?? '—'} ${statusText ?? ''}\n${bodyText || err.message}`);
      }
      try {
        const hist = await api.get(`/api/netshield/history`);
        setRows(hist.data || []);
      } catch {}
      setLoading(false);
    };
    run();
  }, []);

  const total = rows.length;
  const attacks = rows.filter(r => r.result === 'Attack').length;
  const safe = total - attacks;
  const avgConfidence = total ? rows.reduce((a, r) => a + (r.confidence || 0), 0) / total : 0;
  const lastTs = total ? new Date(Math.max(...rows.map(r => new Date(r.timestamp).getTime()))) : null;

  const topSrc = useMemo(() => {
    const m = {};
    rows.forEach(r => { if (r.srcIp) m[r.srcIp] = (m[r.srcIp] || 0) + 1; });
    return Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,5);
  }, [rows]);
  const topDst = useMemo(() => {
    const m = {};
    rows.forEach(r => { if (r.dstIp) m[r.dstIp] = (m[r.dstIp] || 0) + 1; });
    return Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,5);
  }, [rows]);

  return (
    <div>
      <h2>Profile</h2>
      <div className="profile-grid">
        <div className="glass-card identity-card">
          {loading ? (
            <div className="skeleton-row"></div>
          ) : (
            <div className="identity">
              <div className="avatar">🛡️</div>
              <div className="identity-info">
                <div className="identity-name">{user?.username || '—'}</div>
                <div className="identity-email">{user?.email || '—'}</div>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card stats-card" style={{ gridColumn: 'span 3' }}>
          <div className="kpi">
            <div className="kpi-title">Total Scans</div>
            <div className="kpi-value">{total}</div>
          </div>
          <button className="logout-btn" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
        <div className="glass-card stats-card" style={{ gridColumn: 'span 3' }}>
          <div className="kpi">
            <div className="kpi-title">Attacks Detected</div>
            <div className="kpi-value kpi-alert">{attacks}</div>
          </div>
        </div>
        <div className="glass-card stats-card" style={{ gridColumn: 'span 4' }}>
          <div className="kpi">
            <div className="kpi-title">Safe Events</div>
            <div className="kpi-value kpi-safe">{safe}</div>
          </div>
        </div>

        <div className="glass-card stats-card">
          <Gauge value={Math.round(avgConfidence * 100)} />
          <div className="kpi-sub">
            <div className="kpi-title">Last Scan</div>
            <div className="kpi-value">{lastTs ? lastTs.toLocaleString() : '—'}</div>
          </div>
        </div>

        <div className="glass-card threat-tables">
          <div className="table-wrap">
            <div className="table-title">Top Sources</div>
            <table className="modern">
              <thead>
                <tr><th>IP</th><th>Count</th></tr>
              </thead>
              <tbody>
                {topSrc.map(([ip, c]) => (<tr key={ip}><td><span className="ip-badge">{ip}</span></td><td>{c}</td></tr>))}
                {topSrc.length === 0 && (<tr><td colSpan="2">No data</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <div className="table-title">Top Destinations</div>
            <table className="modern">
              <thead>
                <tr><th>IP</th><th>Count</th></tr>
              </thead>
              <tbody>
                {topDst.map(([ip, c]) => (<tr key={ip}><td><span className="ip-badge">{ip}</span></td><td>{c}</td></tr>))}
                {topDst.length === 0 && (<tr><td colSpan="2">No data</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
