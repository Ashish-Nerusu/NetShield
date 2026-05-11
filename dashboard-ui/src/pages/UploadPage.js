import React, { useMemo, useState } from 'react';
import { api, useAuth } from '../context/AuthContext';

function UploadPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState(null);
  const [retryTimer, setRetryTimer] = useState(0);
  const { token } = useAuth();

  const apiOrigin = useMemo(() => {
    const raw =
      process.env.REACT_APP_API_BASE ||
      process.env.REACT_APP_API_URL ||
      (process.env.NODE_ENV === 'production' ? 'https://netshield-gatekeeper.onrender.com' : 'http://localhost:9091');
    return raw.replace(/\/+$/, '').replace(/\.+$/, '');
  }, []);

  const analyzeUrl = useMemo(() => {
    return apiOrigin ? `${apiOrigin}/api/netshield/analyze-file` : `/api/netshield/analyze-file`;
  }, [apiOrigin]);

  const handleUpload = async () => {
    if (!file || loading || retryTimer > 0) return;
    setLoading(true);
    setResult(null);
    setDetected(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(analyzeUrl, formData, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        timeout: 120000
      });

      const { jobId } = response.data;
      if (!jobId) throw new Error("No Job ID received from server");

      // Polling Logic
      const poll = async () => {
        try {
          const statusRes = await api.get(`${apiOrigin}/api/netshield/analysis-status/${jobId}`);
          const { status, result: analysisResult, error } = statusRes.data;

          if (status === 'COMPLETED') {
            setResult(analysisResult);
            if (analysisResult.detected_dataset) setDetected(analysisResult.detected_dataset);
            setLoading(false);
            
            // Local history update
            try {
              let srcLoc = analysisResult.src_location || { lat: 12.9716, lng: 77.5946 };
              let dstLoc = analysisResult.dst_location || { lat: 12.9716, lng: 77.5946 };
              const newAttack = {
                id: Date.now(),
                srcLat: srcLoc.lat,
                srcLng: srcLoc.lng,
                dstLat: dstLoc.lat,
                dstLng: dstLoc.lng,
                type: analysisResult.prediction,
                createdAt: Date.now()
              };
              const prev = JSON.parse(localStorage.getItem('netshield_attacks') || '[]');
              const next = [newAttack, ...prev].slice(0, 10);
              localStorage.setItem('netshield_attacks', JSON.stringify(next));
            } catch {}
            
          } else if (status === 'FAILED') {
            throw new Error(error || "Analysis failed on server");
          } else {
            // Still PENDING or PROCESSING
            setTimeout(poll, 3000);
          }
        } catch (pollError) {
          const s = pollError.response?.status;
          if (s === 429) {
            startRetryTimer();
          }
          setLoading(false);
          setResult({
            prediction: 'Error',
            message: `Polling failed: ${pollError.message}. Ensure backend is awake.`
          });
        }
      };

      setTimeout(poll, 2000);

    } catch (error) {
      const status = error.response?.status;
      if (status === 429) {
        startRetryTimer();
      }
      setResult({
        prediction: 'Error',
        message: status === 429 ? 'Rate limit exceeded. Try again.' : `Upload failed: ${error.message}. Ensure backend is awake.`
      });
      setLoading(false);
    }
  };

  const startRetryTimer = () => {
    setRetryTimer(60);
    const interval = setInterval(() => {
      setRetryTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div>
      <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-2)' }}>Automated Shield</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-6)' }}>Upload a CSV file. Dataset is auto-detected.</p>
      
      <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
        <input type="file" className="input-field" accept=".csv" onChange={(e) => setFile(e.target.files[0])} style={{ marginRight: 'var(--spacing-4)' }} />
        <button className="btn btn-primary" onClick={handleUpload} disabled={loading || retryTimer > 0}>
          {loading ? "Analyzing..." : retryTimer > 0 ? `Retry in ${retryTimer}s` : "Run Detection"}
        </button>
      </div>
      {detected && <p>Detected dataset: {detected}</p>}
      {result && (
        <section className={`card ${result.prediction !== 'Normal' ? 'alert' : 'safe'}`} style={result.prediction !== 'Normal' ? { borderLeft: '4px solid var(--color-danger)' } : { borderLeft: '4px solid var(--color-success)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--color-text-primary)' }}>Result: {result.prediction !== 'Normal' ? `${result.prediction} Detected` : 'Traffic Normal'}</h3>
          <div className="flex gap-6 mb-4">
            <div>
              <span className="text-xs text-muted">THREAT SCORE</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{Number(((result.confidence_score ?? result.threat_score ?? 0) * 100).toFixed(2))}%</div>
            </div>
            <div>
              <span className="text-xs text-muted">SEVERITY</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: result.prediction !== 'Normal' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {result.severity || (result.prediction !== 'Normal' ? 'High' : 'None')}
              </div>
            </div>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-4)' }}>{result.message}</p>
          <div className="flex gap-6 mb-4">
            <div>
              <span className="text-xs text-muted">MODEL</span>
              <div className="text-sm font-semibold">{result.detection_mode || 'Unified'}</div>
            </div>
            <div>
              <span className="text-xs text-muted">DATASET</span>
              <div className="text-sm font-semibold">{detected || 'Auto'}</div>
            </div>
          </div>
          {result.debug_info && (
            <div style={{ padding: 'var(--spacing-4)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-4)' }}>
              <h4 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-2)' }}>Debug Metadata</h4>
              <pre style={{ fontSize: '0.75rem', overflowX: 'auto', margin: 0 }}>
                {JSON.stringify(result.debug_info, null, 2)}
              </pre>
            </div>
          )}
          <div style={{ padding: 'var(--spacing-4)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-2)' }}>Recommended Actions</h4>
            {result.prediction !== 'Normal' ? (
              <ul style={{ margin: 0, paddingLeft: 'var(--spacing-4)', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                <li>Rate-limit suspicious flows immediately.</li>
                <li>Block offending src/dst pairs at the switch.</li>
                <li>Enable packet-in sampling for further inspection.</li>
              </ul>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 'var(--spacing-4)', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                <li>No immediate action required.</li>
                <li>Keep monitoring baseline traffic.</li>
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default UploadPage;