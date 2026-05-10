import React, { useState } from 'react';
import { api } from '../context/AuthContext';
import { API_BASE } from '../shared/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function ManualProbe() {
  const [form, setForm] = useState({
    pktcount: '',
    bytecount: '',
    duration: '',
    flows: '',
    pktpersec: '',
    prio: ''
  });
  const [result, setResult] = useState(null);
  const [explain, setExplain] = useState(null);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    const payload = {
      pktcount: Number(form.pktcount || 0),
      bytecount: Number(form.bytecount || 0),
      duration: Number(form.duration || 0),
      flows: Number(form.flows || 0),
      pktpersec: Number(form.pktpersec || 0),
      prio: Number(form.prio || 0)
    };
    try {
      const res = await api.post(`/api/netshield/analyze-manual`, payload);
      setResult(res.data);
    } catch (err) {
      const status = err.response?.status;
      const statusText = err.response?.statusText;
      const url = err.config?.url || (API_BASE + `/api/netshield/analyze-manual`);
      const body = err.response?.data;
      const bodyText = typeof body === 'string' ? body.slice(0, 800) : JSON.stringify(body);
      alert(`Manual analyze failed:\nHTTP ${status ?? '—'} ${statusText ?? ''}\nURL: ${url}\n${bodyText || err.message}`);
    }
  };
  const runExplain = async () => {
    const payload = {
      pktcount: Number(form.pktcount || 0),
      bytecount: Number(form.bytecount || 0),
      duration: Number(form.duration || 0),
      flows: Number(form.flows || 0),
      pktpersec: Number(form.pktpersec || 0),
      prio: Number(form.prio || 0)
    };
    try {
      const res = await api.post(`/api/netshield/explain-manual`, payload);
      const imp = res.data.importances || {};
      const data = Object.keys(imp).map((k) => ({ name: k, value: Math.round(imp[k] * 100) }));
      data.sort((a,b) => b.value - a.value);
      setExplain(data.slice(0, 10));
    } catch (err) {
      const status = err.response?.status;
      const statusText = err.response?.statusText;
      const url = err.config?.url || (API_BASE + `/api/netshield/explain-manual`);
      const body = err.response?.data;
      const bodyText = typeof body === 'string' ? body.slice(0, 800) : JSON.stringify(body);
      alert(`Explain failed:\nHTTP ${status ?? '—'} ${statusText ?? ''}\nURL: ${url}\n${bodyText || err.message}`);
    }
  };

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-6)' }}>Manual Probe</h2>
      
      <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
          <div className="input-group"><label className="input-label">Packet Count</label><input className="input-field" value={form.pktcount} onChange={update('pktcount')} /></div>
          <div className="input-group"><label className="input-label">Byte Count</label><input className="input-field" value={form.bytecount} onChange={update('bytecount')} /></div>
          <div className="input-group"><label className="input-label">Duration (sec)</label><input className="input-field" value={form.duration} onChange={update('duration')} /></div>
          <div className="input-group"><label className="input-label">Flows</label><input className="input-field" value={form.flows} onChange={update('flows')} /></div>
          <div className="input-group"><label className="input-label">Packets/sec</label><input className="input-field" value={form.pktpersec} onChange={update('pktpersec')} /></div>
          <div className="input-group"><label className="input-label">Priority</label><input className="input-field" value={form.prio} onChange={update('prio')} /></div>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-primary" onClick={submit}>Analyze</button>
          <button className="btn btn-secondary" onClick={runExplain}>Explain</button>
        </div>
      </div>
      {result && (
        <section className={`card ${result.prediction === 'Attack' ? 'alert' : 'safe'}`} style={{ marginBottom: 'var(--spacing-6)', borderLeft: result.prediction === 'Attack' ? '4px solid var(--color-danger)' : '4px solid var(--color-success)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--color-text-primary)' }}>Result: {result.prediction}</h3>
          <div className="flex gap-6 mb-4">
            <div>
              <span className="text-xs text-muted">THREAT SCORE</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{Number(((result.threat_score ?? 0) * 100).toFixed(2))}%</div>
            </div>
            <div>
              <span className="text-xs text-muted">SEVERITY</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: result.prediction === 'Attack' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {result.prediction === 'Attack' ? 'High' : 'None'}
              </div>
            </div>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-4)' }}>{result.message}</p>
          <div style={{ padding: 'var(--spacing-4)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-2)' }}>Recommended Actions</h4>
            {result.prediction === 'Attack' ? (
              <ul style={{ margin: 0, paddingLeft: 'var(--spacing-4)', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                <li>Apply rate limiting on high pkt/sec flows.</li>
                <li>Inspect priority queues for abuse.</li>
                <li>Block top offenders at the SDN controller.</li>
              </ul>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 'var(--spacing-4)', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                <li>Traffic appears normal.</li>
                <li>Maintain current policies.</li>
              </ul>
            )}
          </div>
        </section>
      )}
      {explain && (
        <section className="card">
          <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-4)' }}>Explainability (Top Features)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={explain}>
              <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)' }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)' }} />
              <Tooltip cursor={{ fill: 'var(--color-bg-canvas)' }} contentStyle={{ backgroundColor: 'var(--color-bg-solid)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }} />
              <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {explain[0] && <p style={{ marginTop: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>High Impact: <strong>{explain[0].name}</strong> is atypical compared to baseline.</p>}
        </section>
      )}
    </div>
  );
}

export default ManualProbe;
