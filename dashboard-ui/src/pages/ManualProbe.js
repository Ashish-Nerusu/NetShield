import React, { useState } from 'react';
import axios from 'axios';
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
      const res = await axios.post('http://localhost:9091/api/netshield/analyze-manual', payload);
      setResult(res.data);
    } catch (err) {
      const msg = (err.response && (err.response.data?.detail || err.response.data)) || err.message;
      alert(`Manual analyze failed: ${msg}`);
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
      const res = await axios.post('http://localhost:9091/api/netshield/explain-manual', payload);
      const imp = res.data.importances || {};
      const data = Object.keys(imp).map((k) => ({ name: k, value: Math.round(imp[k] * 100) }));
      data.sort((a,b) => b.value - a.value);
      setExplain(data.slice(0, 10));
    } catch (err) {
      const msg = (err.response && (err.response.data?.detail || err.response.data)) || err.message;
      alert(`Explain failed: ${msg}`);
    }
  };

  return (
    <div className="page-bg-icons bg-manual-probe">
      <h2>Manual Probe</h2>
      <div className="input-group"><label>Packet Count</label><input value={form.pktcount} onChange={update('pktcount')} /></div>
      <div className="input-group"><label>Byte Count</label><input value={form.bytecount} onChange={update('bytecount')} /></div>
      <div className="input-group"><label>Duration (sec)</label><input value={form.duration} onChange={update('duration')} /></div>
      <div className="input-group"><label>Flows</label><input value={form.flows} onChange={update('flows')} /></div>
      <div className="input-group"><label>Packets/sec</label><input value={form.pktpersec} onChange={update('pktpersec')} /></div>
      <div className="input-group"><label>Priority</label><input value={form.prio} onChange={update('prio')} /></div>
      <button onClick={submit}>Analyze</button>
      <button onClick={runExplain} style={{ marginLeft: 8 }}>Explain</button>
      {result && (
        <section className={`result-card ${result.prediction === 'Attack' ? 'alert' : 'safe'}`}>
          <h3>Result: {result.prediction}</h3>
          <div className="stats">
            <p>Threat Score: {Number(((result.threat_score ?? 0) * 100).toFixed(2))}%</p>
            <p>Severity: {result.prediction === 'Attack' ? 'High' : 'None'}</p>
          </div>
          <p>{result.message}</p>
          {result.prediction === 'Attack' ? (
            <ul>
              <li>Apply rate limiting on high pkt/sec flows.</li>
              <li>Inspect priority queues for abuse.</li>
              <li>Block top offenders at the SDN controller.</li>
            </ul>
          ) : (
            <ul>
              <li>Traffic appears normal.</li>
              <li>Maintain current policies.</li>
            </ul>
          )}
        </section>
      )}
      {explain && (
        <section className="result-card">
          <h3>Explainability (Top Features)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={explain}>
              <XAxis dataKey="name" tick={{ fill: '#c9d1d9' }} />
              <YAxis tick={{ fill: '#c9d1d9' }} />
              <Tooltip />
              <Bar dataKey="value" fill="#58a6ff" />
            </BarChart>
          </ResponsiveContainer>
          {explain[0] && <p>High Impact: {explain[0].name} is atypical compared to baseline.</p>}
        </section>
      )}
    </div>
  );
}

export default ManualProbe;
