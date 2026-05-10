import React, { useState } from 'react';
import { api } from '../context/AuthContext';

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
      const res = await api.post(`/api/netshield/agent`, { message: userMsg.text });
      const ai = res.data || {};
      const text = ai.reply || 'No response received.';
      setMessages((m) => [...m, { role: 'assistant', text }]);
    } catch (e) {
      const errorData = e.response && e.response.data;
      const errorMsg = typeof errorData === 'string' ? errorData : (errorData && errorData.error) || (errorData && errorData.detail) || e.message;
      setMessages((m) => [...m, { role: 'assistant', text: `Error: ${errorMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)' }}>Agentic AI</h2>
      <div className="card" style={{ display: 'grid', gridTemplateRows: '1fr auto', height: 460 }}>
        <div style={{ overflow: 'auto', padding: 8 }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ margin: '8px 0', display: 'flex' }}>
              <div style={{
                marginLeft: m.role === 'assistant' ? 0 : 'auto',
                background: m.role === 'assistant' ? 'var(--color-primary-light)' : 'var(--color-bg-canvas)',
                border: '1px solid ' + (m.role === 'assistant' ? 'var(--color-primary)' : 'var(--color-border)'),
                color: m.role === 'assistant' ? 'var(--color-primary)' : 'var(--color-text-primary)',
                padding: '10px 14px', borderRadius: 'var(--radius-lg)', maxWidth: '70%',
                fontSize: '0.875rem'
              }}>{m.text}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
          <input 
            className="input-field"
            style={{ flex: 1 }}
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="e.g., Summarize the attack from 10.0.0.1" 
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button className="btn btn-primary" onClick={send} disabled={loading}>{loading ? 'Thinking...' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}

export default AgentBot;
