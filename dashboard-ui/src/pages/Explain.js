import React, { useState } from 'react';
import { api } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { ShieldCheck, ShieldAlert, Activity, AlertTriangle, Cpu, Info, CheckCircle2 } from 'lucide-react';
import './Explain.css';

const THREAT_PATTERNS = {
  pktpersec: {
    name: "Packet Velocity",
    highMsg: "Extremely high packet/sec rate strongly matched Volumetric / DDoS behavior.",
    lowMsg: "Abnormally low packet rate detected."
  },
  bytecount: {
    name: "Data Transfer Volume",
    highMsg: "Large byte transfer suggests possible exfiltration or heavy payload activity.",
    lowMsg: "Unusually low byte count for this protocol type."
  },
  flows: {
    name: "Flow Density",
    highMsg: "High concurrent flow density indicates potential reconnaissance or scanning.",
    lowMsg: "Isolated flow counts detected."
  },
  duration: {
    name: "Connection Duration",
    highMsg: "Prolonged connection duration suggests tunneling or persistent beaconing.",
    lowMsg: "Ultra-short connection durations match probing or brute-force characteristics."
  },
  prio: {
    name: "Queue Priority",
    highMsg: "Suspicious abuse of high-priority traffic queues detected.",
    lowMsg: "Unexpected priority queue assignment."
  },
  pktcount: {
    name: "Packet Count",
    highMsg: "Massive packet burst detected, characteristic of flood attacks.",
    lowMsg: "Minimal packet count with anomalous flags."
  }
};

function getSeverityColor(sev) {
  const s = (sev || '').toLowerCase();
  if (s.includes('critical')) return 'var(--color-danger)';
  if (s.includes('high')) return 'var(--color-warning)';
  if (s.includes('medium')) return '#eab308';
  if (s.includes('low')) return 'var(--color-primary)';
  return 'var(--color-success)';
}

function getAIReasoning(topFeatures, prediction, formValues) {
  if (prediction !== 'Attack') {
    return "Traffic baseline appears normal. All features fall within expected operational thresholds. No anomalous indicators detected.";
  }
  
  if (!topFeatures || topFeatures.length === 0) {
    return "Multiple network features deviated from the baseline, suggesting an anomaly, but no single dominant feature could be isolated.";
  }

  const primary = topFeatures[0];
  const pattern = THREAT_PATTERNS[primary.name.toLowerCase()];
  
  if (!pattern) return `Anomalous activity strongly correlated with '${primary.name}'.`;
  
  // Basic heuristic to check if the value was high or low (assuming 0 is low for these metrics)
  const val = formValues[primary.name.toLowerCase()] || 0;
  // Thresholds are arbitrary for this heuristic, real ML would know the mean
  const isHigh = val > 10; 
  
  return isHigh ? pattern.highMsg : pattern.lowMsg;
}

function Explain() {
  const [form, setForm] = useState({ pktcount: 50000, bytecount: 1048576, duration: 1.2, flows: 300, pktpersec: 45000, prio: 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    const payload = {
      pktcount: Number(form.pktcount || 0),
      bytecount: Number(form.bytecount || 0),
      duration: Number(form.duration || 0),
      flows: Number(form.flows || 0),
      pktpersec: Number(form.pktpersec || 0),
      prio: Number(form.prio || 0)
    };

    try {
      // Execute Unified Workflow
      const [analyzeRes, explainRes] = await Promise.all([
        api.post(`/api/netshield/analyze-manual`, payload),
        api.post(`/api/netshield/explain-manual`, payload)
      ]);

      const prediction = analyzeRes.data.prediction;
      const score = analyzeRes.data.threat_score || 0;
      
      const imps = explainRes.data.importances || {};
      let features = Object.entries(imps).map(([name, value]) => ({ 
        name, 
        value: Number(value),
        displayName: THREAT_PATTERNS[name.toLowerCase()]?.name || name
      }));
      
      // Sort descending and grab top 5
      features.sort((a,b) => b.value - a.value);
      features = features.slice(0, 5);

      // Determine severity based on score
      let severity = 'Safe';
      if (prediction === 'Attack') {
        const confPct = score * 100;
        if (confPct >= 92) severity = 'Critical';
        else if (confPct >= 80) severity = 'High';
        else if (confPct >= 65) severity = 'Medium';
        else severity = 'Low';
      }

      const reasoning = getAIReasoning(features, prediction, payload);

      setData({
        prediction,
        score,
        severity,
        features,
        reasoning,
        rawInputs: payload
      });

    } catch (e) {
      console.error(e);
      setError("Failed to generate XAI analysis. Please verify the AI engine is reachable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="xai-container">
      <div className="xai-header">
        <h2>Explainable AI (XAI) Console</h2>
        <p className="text-secondary">Analyze traffic features and generate transparent AI reasoning.</p>
      </div>

      {/* Input Section */}
      <div className="xai-card input-section">
        <div className="input-grid">
          {Object.keys(form).map((k) => (
            <div key={k} className="input-group">
              <label className="input-label">{THREAT_PATTERNS[k]?.name || k}</label>
              <input 
                className="input-field" 
                type="number"
                value={form[k]} 
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} 
              />
            </div>
          ))}
        </div>
        <div className="xai-actions">
          <button className="btn btn-primary btn-lg" onClick={runAnalysis} disabled={loading}>
            {loading ? <><Activity className="spin mr-2" size={18}/> Analyzing...</> : <><Cpu className="mr-2" size={18}/> Analyze & Explain</>}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="xai-alert error">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="xai-skeleton-loader">
          <div className="skeleton-pulse"></div>
          <p>Generating AI reasoning...</p>
        </div>
      )}

      {/* Results Section */}
      {data && !loading && (
        <div className="xai-results-grid">
          
          {/* Overview Panel */}
          <div className="xai-card overview-panel" style={{ borderTop: `4px solid ${getSeverityColor(data.severity)}` }}>
            <div className="result-header">
              {data.prediction === 'Attack' ? (
                <ShieldAlert size={40} color={getSeverityColor(data.severity)} />
              ) : (
                <ShieldCheck size={40} color={getSeverityColor(data.severity)} />
              )}
              <div>
                <h3 className="result-title">{data.prediction} Detected</h3>
                <span className="result-severity" style={{ color: getSeverityColor(data.severity) }}>
                  Severity: {data.severity}
                </span>
              </div>
            </div>

            <div className="confidence-section">
              <div className="confidence-header">
                <span>AI Confidence Score</span>
                <strong>{(data.score * 100).toFixed(1)}%</strong>
              </div>
              <div className="confidence-track">
                <div 
                  className="confidence-fill" 
                  style={{ 
                    width: `${data.score * 100}%`,
                    backgroundColor: getSeverityColor(data.severity)
                  }}
                ></div>
              </div>
            </div>

            <div className="reasoning-box">
              <h4 className="reasoning-title"><Info size={16} className="mr-2"/> AI Reasoning</h4>
              <p className="reasoning-text">{data.reasoning}</p>
            </div>
          </div>

          {/* Feature Importance Panel */}
          <div className="xai-card feature-panel">
            <h3>Feature Importance Analysis</h3>
            <p className="text-secondary mb-4">Top metrics contributing to the AI classification.</p>
            
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.features} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="displayName" type="category" axisLine={false} tickLine={false} width={120} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--color-bg-canvas)' }} 
                    contentStyle={{ backgroundColor: 'var(--color-bg-solid)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }} 
                    formatter={(value) => `${(value * 100).toFixed(1)}% weight`}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {data.features.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={data.prediction === 'Attack' ? getSeverityColor(data.severity) : 'var(--color-success)'} opacity={1 - (index * 0.15)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Suspicious Indicators Panel */}
          {data.prediction === 'Attack' && (
            <div className="xai-card indicators-panel">
              <h3>Suspicious Indicators</h3>
              <div className="indicator-chips">
                {data.features.filter(f => f.value > 0.1).map(f => (
                  <div key={f.name} className="indicator-chip" style={{ borderLeftColor: getSeverityColor(data.severity) }}>
                    <AlertTriangle size={16} color={getSeverityColor(data.severity)} />
                    <div className="chip-content">
                      <span className="chip-title">Anomalous {f.displayName}</span>
                      <span className="chip-val">Weight: {(f.value * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="recommendations-box">
                <h4 className="flex items-center"><CheckCircle2 size={16} className="mr-2 text-success"/> Recommended Actions</h4>
                <ul>
                  <li>Apply immediate rate limiting to Source IP.</li>
                  <li>Review firewall rules for {data.features[0]?.displayName} anomalies.</li>
                  <li>Escalate critical alerts to Tier 2 SOC Analyst.</li>
                </ul>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default Explain;
