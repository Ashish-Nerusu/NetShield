import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../shared/api';

function AgentBot() {
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Ask me about any IP or incident.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/netshield/agent`, { prompt: userMsg.text });
      const ai = res.data || {};
      const text = `${ai.summary}\nRisk: ${ai.riskLevel}\nNext: ${ai.nextSteps}`;
      setMessages((m) => [...m, { role: 'assistant', text }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: (e.response && e.response.data) || e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Agentic AI</h2>
      <div className="glass-card" style={{ display: 'grid', gridTemplateRows: '1fr auto', height: 420 }}>
        <div style={{ overflow: 'auto', padding: 8 }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ margin: '8px 0', display: 'flex' }}>
              <div style={{
                marginLeft: m.role === 'assistant' ? 0 : 'auto',
                background: m.role === 'assistant' ? 'rgba(14,165,233,0.15)' : 'rgba(248,81,73,0.15)',
                border: '1px solid ' + (m.role === 'assistant' ? 'rgba(14,165,233,0.35)' : 'rgba(248,81,73,0.35)'),
                padding: '8px 12px', borderRadius: 12, maxWidth: '70%'
              }}>{m.text}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g., Summarize the attack from 10.0.0.1" />
          <button onClick={send} disabled={loading}>{loading ? 'Thinking...' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}

export default AgentBot;
