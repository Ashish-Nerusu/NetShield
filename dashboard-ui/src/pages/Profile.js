import React, { useEffect, useMemo, useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Gauge({ value }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const bg = `conic-gradient(var(--color-success) ${pct * 3.6}deg, var(--color-bg-canvas) ${pct * 3.6}deg)`;
  return (
    <div className="flex-col items-center gap-2">
      <div style={{ 
        width: '100px', 
        height: '100px', 
        borderRadius: '50%', 
        background: bg,
        display: 'grid',
        placeItems: 'center',
        position: 'relative'
      }}>
        <div style={{ 
          width: '70px', 
          height: '70px', 
          borderRadius: '50%', 
          backgroundColor: 'var(--color-bg-solid)',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          fontSize: '1.25rem'
        }}>
          {pct}%
        </div>
      </div>
      <div className="text-xs text-muted font-semibold uppercase tracking-wider">Avg Confidence</div>
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
      <div className="flex justify-between items-center mb-6">
        <h2 style={{ color: 'var(--color-text-primary)', margin: 0 }}>Security Profile</h2>
        <button className="btn btn-secondary danger" onClick={() => { logout(); navigate('/login'); }}>
          Sign Out
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 'var(--spacing-6)' }}>
        {/* Identity Card */}
        <div className="card" style={{ gridColumn: 'span 4', display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
          {loading ? (
            <div style={{ height: '40px', width: '100%', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)' }}></div>
          ) : (
            <>
              <div style={{ 
                width: '64px', height: '64px', borderRadius: 'var(--radius-lg)', 
                backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)',
                display: 'grid', placeItems: 'center', fontSize: '1.5rem'
              }}>
                {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{user?.username || '—'}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{user?.email || '—'}</div>
                <div className="badge badge-primary mt-2">Security Analyst</div>
              </div>
            </>
          )}
        </div>

        {/* Stats Section */}
        <div className="card metric-card" style={{ gridColumn: 'span 2' }}>
          <span className="text-xs text-muted font-semibold uppercase">Total Scans</span>
          <div className="metric-value" style={{ color: 'var(--color-primary)' }}>{total}</div>
        </div>

        <div className="card metric-card" style={{ gridColumn: 'span 2' }}>
          <span className="text-xs text-muted font-semibold uppercase">Attacks Detected</span>
          <div className="metric-value" style={{ color: 'var(--color-danger)' }}>{attacks}</div>
        </div>

        <div className="card metric-card" style={{ gridColumn: 'span 2' }}>
          <span className="text-xs text-muted font-semibold uppercase">Safe Events</span>
          <div className="metric-value" style={{ color: 'var(--color-success)' }}>{safe}</div>
        </div>

        <div className="card flex items-center justify-center" style={{ gridColumn: 'span 2' }}>
          <Gauge value={Math.round(avgConfidence * 100)} />
        </div>

        {/* Tables Section */}
        <div className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-4)' }}>Top Traffic Sources</h3>
          <table className="table">
            <thead>
              <tr><th>Source IP</th><th className="text-right">Incident Count</th></tr>
            </thead>
            <tbody>
              {topSrc.map(([ip, c]) => (
                <tr key={ip}>
                  <td><code style={{ padding: '2px 6px', backgroundColor: 'var(--color-bg-canvas)', borderRadius: '4px' }}>{ip}</code></td>
                  <td className="text-right font-semibold">{c}</td>
                </tr>
              ))}
              {topSrc.length === 0 && (<tr><td colSpan="2" className="text-center text-muted">No data available</td></tr>)}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ gridColumn: 'span 6' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-4)' }}>Top Targets</h3>
          <table className="table">
            <thead>
              <tr><th>Destination IP</th><th className="text-right">Incident Count</th></tr>
            </thead>
            <tbody>
              {topDst.map(([ip, c]) => (
                <tr key={ip}>
                  <td><code style={{ padding: '2px 6px', backgroundColor: 'var(--color-bg-canvas)', borderRadius: '4px' }}>{ip}</code></td>
                  <td className="text-right font-semibold">{c}</td>
                </tr>
              ))}
              {topDst.length === 0 && (<tr><td colSpan="2" className="text-center text-muted">No data available</td></tr>)}
            </tbody>
          </table>
        </div>

        {/* System Activity */}
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-muted">Last System Activity</span>
            <span className="text-sm text-primary">{lastTs ? lastTs.toLocaleString() : '—'}</span>
          </div>
          <div style={{ height: '4px', width: '100%', backgroundColor: 'var(--color-bg-canvas)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '100%', backgroundColor: 'var(--color-primary)', opacity: 0.1 }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
