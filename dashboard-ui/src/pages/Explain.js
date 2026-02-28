import React, { useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function Explain() {
  const [form, setForm] = useState({ pktcount: 100, bytecount: 2000, duration: 1.2, flows: 3, pktpersec: 85, prio: 1 });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:9091/api/netshield/explain-manual', form);
      const imps = res.data.importances || {};
      const arr = Object.entries(imps).map(([name, value]) => ({ name, value }));
      arr.sort((a,b) => b.value - a.value);
      setData(arr);
    } catch (e) {
      alert((e.response && e.response.data) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Explainable AI</h2>
      <div className="glass-card" style={{ marginBottom: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {Object.keys(form).map((k) => (
            <div key={k}>
              <div className="kpi-title">{k}</div>
              <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <button onClick={run} disabled={loading} style={{ marginTop: 12 }}>{loading ? 'Explaining...' : 'Explain'}</button>
      </div>
      <div className="glass-card" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value">
              {data.map((entry, index) => {
                const highlight = entry.name.toLowerCase().includes('pktpersec') && entry.value > 0.2;
                return <Cell key={`cell-${index}`} fill={highlight ? '#f85149' : '#3fb950'} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default Explain;
