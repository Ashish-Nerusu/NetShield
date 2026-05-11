import React, { useEffect, useState } from 'react';
import { api } from '../context/AuthContext';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet';
import { ShieldCheck, ShieldAlert, AlertTriangle, Shield, Clock, Crosshair } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './LiveMap.css';

function getSeverityColor(severity) {
  const sev = (severity || '').toLowerCase();
  if (sev.includes('critical')) return 'var(--color-danger)'; // Red
  if (sev.includes('high')) return 'var(--color-warning)'; // Orange/Amber
  if (sev.includes('medium')) return '#eab308'; // Yellow
  if (sev.includes('low')) return 'var(--color-primary)'; // Blue
  return 'var(--color-success)'; // Green
}

function getSeverityIcon(severity) {
  const sev = (severity || '').toLowerCase();
  if (sev.includes('critical')) return <ShieldAlert size={14} />;
  if (sev.includes('high')) return <AlertTriangle size={14} />;
  if (sev.includes('medium')) return <AlertTriangle size={14} />;
  if (sev.includes('low')) return <Shield size={14} />;
  return <ShieldCheck size={14} />;
}

function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleTimeString(undefined, { 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });
}

function LiveMap() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = async () => {
    try {
      const res = await api.get('/api/netshield/metrics');
      setIncidents(res.data?.recentIncidents || []);
    } catch (err) {
      console.error("Error fetching map data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const id = setInterval(fetchIncidents, 30000); // 30 sec polling
    return () => clearInterval(id);
  }, []);

  return (
    <div className="livemap-page">
      <div className="livemap-header">
        <h2 className="livemap-title">Live Attack Map</h2>
        <div className="livemap-status">
          <span className="status-indicator live-pulse"></span>
          Monitoring Global Activity
        </div>
      </div>

      <div className="livemap-layout">
        {/* Map Section */}
        <div className="livemap-container">
          <MapContainer 
            center={[25, 0]} 
            zoom={2.5} 
            minZoom={2}
            className="leaflet-map-wrapper"
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            
            {incidents.map((incident) => {
              if (incident.srcLat == null || incident.dstLat == null) return null;
              
              const color = getSeverityColor(incident.severity);
              const isAttack = incident.severity !== 'Safe' && incident.severity !== 'None';
              
              return (
                <React.Fragment key={incident.eventUuid}>
                  {/* Source Node */}
                  <CircleMarker
                    center={[incident.srcLat, incident.srcLng]}
                    radius={isAttack ? 7 : 5}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.8 }}
                  >
                    <Popup className="custom-popup">
                      <div className="popup-content">
                        <strong>Source</strong>
                        <div>IP: {incident.sourceIp || 'Unknown'}</div>
                        <div>Loc: {incident.srcCity}, {incident.srcCountry}</div>
                        <div style={{color}}>Severity: {incident.severity}</div>
                      </div>
                    </Popup>
                    <Tooltip direction="top" offset={[0, -5]}>{incident.sourceIp}</Tooltip>
                  </CircleMarker>

                  {/* Destination Node */}
                  <CircleMarker
                    center={[incident.dstLat, incident.dstLng]}
                    radius={5}
                    pathOptions={{ color: 'var(--color-primary)', fillColor: 'var(--color-primary)', fillOpacity: 0.8 }}
                  >
                    <Popup className="custom-popup">
                      <div className="popup-content">
                        <strong>Destination</strong>
                        <div>IP: {incident.destinationIp || 'Internal Net'}</div>
                        <div>Loc: {incident.dstCity}, {incident.dstCountry}</div>
                      </div>
                    </Popup>
                  </CircleMarker>

                  {/* Attack Flow Line */}
                  <Polyline
                    positions={[
                      [incident.srcLat, incident.srcLng], 
                      [incident.dstLat, incident.dstLng]
                    ]}
                    pathOptions={{ color, weight: isAttack ? 2 : 1 }}
                    className={isAttack ? 'animated-flow-line' : 'static-flow-line'}
                  >
                    <Popup className="custom-popup">
                      <div className="popup-content">
                        <strong>{incident.attackType || 'Normal Traffic'}</strong>
                        <div>Type: {incident.attackType}</div>
                        <div>Conf: {incident.confidence ? `${(incident.confidence*100).toFixed(1)}%` : 'N/A'}</div>
                        <div>Time: {formatDate(incident.timestamp)}</div>
                        <div>Module: {incident.sourceModule}</div>
                      </div>
                    </Popup>
                  </Polyline>
                </React.Fragment>
              );
            })}
          </MapContainer>

          {/* Empty State Overlay if no incidents */}
          {!loading && incidents.length === 0 && (
            <div className="map-empty-overlay">
              <ShieldCheck size={32} className="mb-2" style={{color: 'var(--color-text-muted)'}} />
              <span>No active threat flows detected.</span>
            </div>
          )}
        </div>

        {/* Live Threat Feed Panel */}
        <div className="live-feed-panel">
          <div className="feed-header">
            <h3>Intelligence Feed</h3>
            <span className="feed-count">{incidents.length} Events</span>
          </div>
          
          <div className="feed-list">
            {incidents.length === 0 ? (
              <div className="feed-empty">
                System operational.<br/>Monitoring for threats...
              </div>
            ) : (
              incidents.map((inc) => (
                <div key={inc.eventUuid} className="feed-card">
                  <div className="feed-card-header">
                    <span className="feed-attack-type" style={{color: getSeverityColor(inc.severity)}}>
                      {getSeverityIcon(inc.severity)}
                      {inc.attackType || 'Traffic Flow'}
                    </span>
                    <span className="feed-time"><Clock size={12}/> {formatDate(inc.timestamp)}</span>
                  </div>
                  
                  <div className="feed-route">
                    <div className="route-node">
                      <span className="node-label">SRC</span>
                      <span className="node-val">{inc.sourceIp || 'Unknown'}</span>
                      <span className="node-geo">{inc.srcCountry || 'N/A'}</span>
                    </div>
                    <div className="route-arrow" style={{color: getSeverityColor(inc.severity)}}>→</div>
                    <div className="route-node">
                      <span className="node-label">DST</span>
                      <span className="node-val">{inc.destinationIp || 'Internal'}</span>
                      <span className="node-geo">{inc.dstCountry || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="feed-footer">
                    <span className="feed-module">{inc.sourceModule}</span>
                    {inc.confidence && (
                      <span className="feed-conf" title="Confidence Score">
                        <Crosshair size={12}/> {(inc.confidence*100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveMap;
