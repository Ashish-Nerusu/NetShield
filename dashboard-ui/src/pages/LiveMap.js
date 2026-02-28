import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, CircleMarker, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function LiveMap() {
  const [attacks, setAttacks] = useState([]);
  const [live, setLive] = useState([]);
const [home] = useState({ lat: 12.9716, lng: 77.5946 });
  useEffect(() => {
    const run = async () => {
      const res = await axios.get('http://localhost:9091/api/netshield/history');
      const rows = res.data || [];
      const latest = rows.slice(-10);
      const enriched = [];
      for (const r of latest) {
        if (!r.srcIp) continue;
        try {
          const geo = await axios.get('http://localhost:9091/api/netshield/geo', { params: { ip: r.srcIp } });
          enriched.push({ ...r, geo: geo.data });
        } catch {}
      }
      setAttacks(enriched);
    };
    run();
    const id = setInterval(run, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const tick = () => {
      try {
        const now = Date.now();
        const arr = JSON.parse(localStorage.getItem('netshield_attacks') || '[]')
          .filter(a => now - (a.createdAt || 0) < 30000);
        setLive(arr);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h2>Live Attack Map</h2>
      <MapContainer center={[20, 0]} zoom={2} style={{ height: 500, borderRadius: 12 }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <CircleMarker center={[home.lat, home.lng]} radius={6} pathOptions={{ color: '#58a6ff' }} />
        {attacks.map((a) => (
          <React.Fragment key={a.id}>
            <CircleMarker
              center={[a.geo.lat, a.geo.lng]}
              radius={6}
              pathOptions={{ color: a.result === 'Attack' ? '#f85149' : '#3fb950' }}
              className="pulse"
            />
            <Polyline
              positions={[[a.geo.lat, a.geo.lng], [home.lat, home.lng]]}
              pathOptions={{ color: a.result === 'Attack' ? '#f85149' : '#3fb950', weight: 2 }}
            />
          </React.Fragment>
        ))}
        {live.map((a) => (
          <React.Fragment key={a.id}>
            <CircleMarker
              center={[a.srcLat, a.srcLng]}
              radius={7}
              pathOptions={{ color: '#f85149' }}
              className="pulse"
            />
            <CircleMarker
              center={[a.dstLat, a.dstLng]}
              radius={6}
              pathOptions={{ color: '#3fb950' }}
            />
            <Polyline
              positions={[[a.srcLat, a.srcLng], [a.dstLat, a.dstLng]]}
              pathOptions={{ color: a.type === 'Attack' ? '#f85149' : '#3fb950', weight: 2 }}
            />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
}

export default LiveMap;
