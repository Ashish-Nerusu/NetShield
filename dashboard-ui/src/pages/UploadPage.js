import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../shared/api';

function UploadPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState(null);

  const handleUpload = async () => {
    if (!file) return alert("Please select a CSV file first!");
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post(
        `${API_BASE}/api/netshield/analyze-file`,
        formData
      );
      setResult(response.data);
      if (response.data.detected_dataset) setDetected(response.data.detected_dataset);
      try {
        let srcLoc = response.data.src_location;
        let dstLoc = response.data.dst_location;
        if (!srcLoc && response.data.src_ip) {
          const geo = await axios.get(`${API_BASE}/api/netshield/geo`, { params: { ip: response.data.src_ip } });
          srcLoc = { lat: geo.data.lat, lng: geo.data.lng };
        }
        if (!dstLoc && response.data.dst_ip) {
          const geo = await axios.get(`${API_BASE}/api/netshield/geo`, { params: { ip: response.data.dst_ip } });
          dstLoc = { lat: geo.data.lat, lng: geo.data.lng };
        }
        srcLoc = srcLoc || { lat: 12.9716, lng: 77.5946 };
        dstLoc = dstLoc || { lat: 12.9716, lng: 77.5946 };
        const newAttack = {
          id: Date.now(),
          srcLat: srcLoc.lat,
          srcLng: srcLoc.lng,
          dstLat: dstLoc.lat,
          dstLng: dstLoc.lng,
          type: response.data.prediction,
          createdAt: Date.now()
        };
        const prev = JSON.parse(localStorage.getItem('netshield_attacks') || '[]');
        const next = [newAttack, ...prev].slice(0, 10);
        localStorage.setItem('netshield_attacks', JSON.stringify(next));
      } catch {}
    } catch (error) {
      const serverMsg =
        (error.response && (error.response.data?.detail || error.response.data)) ||
        error.message;
      alert(`Upload failed: ${serverMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-bg-icons bg-automated-shield">
      <h2>Automated Shield</h2>
      <p>Upload a CSV file. Dataset is auto-detected.</p>
      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Analyzing..." : "Run Detection"}
      </button>
      {detected && <p>Detected dataset: {detected}</p>}
      {result && (
        <section className={`result-card ${result.prediction === 'Attack' ? 'alert' : 'safe'}`}>
          <h3>Result: {result.prediction}</h3>
          <div className="stats">
            <p>Threat Score: {Number(((result.confidence_score ?? result.threat_score ?? 0) * 100).toFixed(2))}%</p>
            <p>Severity: {result.severity || (result.prediction === 'Attack' ? 'High' : 'None')}</p>
          </div>
          <p>{result.message}</p>
          <div className="stats">
            <p>Model: {result.detection_mode || 'Unified'}</p>
            <p>Dataset: {detected || 'Auto'}</p>
          </div>
          {result.prediction === 'Attack' ? (
            <ul>
              <li>Rate-limit suspicious flows immediately.</li>
              <li>Block offending src/dst pairs at the switch.</li>
              <li>Enable packet-in sampling for further inspection.</li>
            </ul>
          ) : (
            <ul>
              <li>No immediate action required.</li>
              <li>Keep monitoring baseline traffic.</li>
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default UploadPage;
