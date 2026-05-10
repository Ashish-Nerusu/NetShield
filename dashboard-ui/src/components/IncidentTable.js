import React from 'react';
import './IncidentTable.css';
import { ShieldCheck, ShieldAlert, Shield, AlertTriangle } from 'lucide-react';

function getSeverityBadge(severity) {
  const sev = severity ? severity.toLowerCase() : 'safe';
  if (sev.includes('critical')) return <span className="chip chip-critical"><ShieldAlert size={14} className="mr-1"/> Critical</span>;
  if (sev.includes('high')) return <span className="chip chip-high"><AlertTriangle size={14} className="mr-1"/> High</span>;
  if (sev.includes('medium')) return <span className="chip chip-medium"><AlertTriangle size={14} className="mr-1"/> Medium</span>;
  if (sev.includes('low')) return <span className="chip chip-low"><Shield size={14} className="mr-1"/> Low</span>;
  return <span className="chip chip-safe"><ShieldCheck size={14} className="mr-1"/> Safe</span>;
}

function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleString(undefined, { 
    month: 'short', day: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });
}

function IncidentTable({ incidents }) {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="table-card">
        <h3 className="table-title">Recent Incidents</h3>
        <div className="table-empty-state">
          <ShieldCheck size={48} className="text-muted mb-2" />
          <p>System operating normally. No threats detected yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-card">
      <h3 className="table-title">Recent Incidents</h3>
      <div className="table-responsive">
        <table className="incident-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Source Module</th>
              <th>Attack Type</th>
              <th>Source IP</th>
              <th>Severity</th>
              <th>Confidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident, idx) => (
              <tr key={incident.eventUuid || idx} className="table-row">
                <td className="text-secondary">{formatDate(incident.timestamp)}</td>
                <td className="font-medium">{incident.sourceModule}</td>
                <td>{incident.attackType || 'Normal'}</td>
                <td className="text-secondary font-mono">{incident.sourceIp || 'N/A'}</td>
                <td>{getSeverityBadge(incident.severity)}</td>
                <td>
                  {incident.confidence !== null && incident.confidence !== undefined 
                    ? `${(incident.confidence * 100).toFixed(1)}%` 
                    : 'N/A'}
                </td>
                <td>
                  <span className={`status-dot ${incident.eventStatus === 'Active' ? 'dot-active' : 'dot-resolved'}`}></span>
                  {incident.eventStatus || 'Active'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default IncidentTable;
