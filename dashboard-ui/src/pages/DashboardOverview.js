import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { ShieldAlert, ShieldCheck, Activity, Target, Server, Crosshair } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { DetectionTimelineChart, ThreatDistributionChart } from '../components/DashboardCharts';
import IncidentTable from '../components/IncidentTable';
import './DashboardOverview.css';

function DashboardOverview() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    try {
      const res = await api.get('/api/netshield/metrics');
      setMetrics(res.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching metrics:", err);
      setError("Failed to load SOC intelligence data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Polling every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <Activity size={48} className="loading-icon" />
          <p>Initializing SOC Intelligence...</p>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-error">
          <ShieldAlert size={48} className="text-danger mb-2" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // --- Derived Data Transformations ---
  
  // 1. Timeline
  const timelineData = metrics?.detectionTimeline 
    ? Object.entries(metrics.detectionTimeline)
        .map(([time, count]) => ({ time, count }))
        .sort((a, b) => a.time.localeCompare(b.time))
    : [];

  // 2. Threat Distribution
  const threatDistData = metrics?.threatDistribution
    ? Object.entries(metrics.threatDistribution).map(([name, value]) => ({ name, value }))
    : [];

  // 3. Severity Distribution
  const critical = Number(metrics?.criticalThreats) || 0;
  const high = (Number(metrics?.highSeverityThreats) || 0) - critical;
  const other = (Number(metrics?.totalThreats) || 0) - (Number(metrics?.highSeverityThreats) || 0);
  
  const severityDistData = [
    { name: 'Critical', value: Math.max(0, critical) },
    { name: 'High', value: Math.max(0, high) },
    { name: 'Medium/Low/Safe', value: Math.max(0, other) }
  ].filter(d => d.value > 0);

  // 4. Top Metrics
  const activeIncidents = parseInt(metrics?.liveStatusMetrics?.["Active Events"] || "0", 10) || 0;
  const accuracy = metrics?.averageConfidence ? (Number(metrics.averageConfidence) * 100).toFixed(1) : "0.0";
  const monitoredIps = 12; // Derived mock value as approved
  const activeModelsCount = metrics?.activeModels ? Object.keys(metrics.activeModels).length : 1;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">SOC Intelligence Overview</h2>
        <div className="dashboard-status">
          <span className="status-indicator live-pulse"></span>
          System {metrics?.liveStatusMetrics?.["System Status"] || "Operational"}
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="metrics-grid">
        <MetricCard 
          title="Total Threats" 
          value={metrics?.totalThreats || 0} 
          icon={ShieldAlert}
          colorClass="primary"
        />
        <MetricCard 
          title="Critical Threats" 
          value={critical} 
          icon={AlertTriangle => <ShieldAlert size={20} />} // just mapping the icon visually
          colorClass={critical > 0 ? "danger" : "success"}
        />
        <MetricCard 
          title="Active Incidents" 
          value={activeIncidents} 
          icon={Activity}
          colorClass={activeIncidents > 0 ? "warning" : "success"}
        />
        <MetricCard 
          title="Detection Confidence" 
          value={`${accuracy}%`} 
          icon={Crosshair}
          colorClass="secondary"
        />
        <MetricCard 
          title="Monitored Interfaces" 
          value={monitoredIps} 
          icon={Server}
          colorClass="primary"
          trendLabel="Active endpoints"
        />
        <MetricCard 
          title="Active AI Models" 
          value={activeModelsCount} 
          icon={Target}
          colorClass="secondary"
        />
      </div>

      {/* Charts Row */}
      <div className="charts-grid">
        <div className="chart-span-2">
          <DetectionTimelineChart data={timelineData} />
        </div>
        <div>
          <ThreatDistributionChart data={threatDistData} title="Attack Vector Breakdown" />
        </div>
        <div>
          <ThreatDistributionChart data={severityDistData} title="Severity Distribution" />
        </div>
      </div>

      {/* Incident Table */}
      <div className="table-section">
        <IncidentTable incidents={metrics?.recentIncidents || []} />
      </div>
    </div>
  );
}

export default DashboardOverview;
