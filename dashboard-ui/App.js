import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [dataset, setDataset] = useState('sdn');
  const [modelType, setModelType] = useState('dl');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Please select a CSV file first!");
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Talking to our Spring Boot Bridge on 8080 (or 8081)
      const response = await axios.post(
        `http://localhost:8080/api/netshield/analyze/${dataset}/${modelType}`, 
        formData
      );
      setResult(response.data);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to connect to Gatekeeper. Is Spring Boot running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard dark-theme">
      <header>
        <h1>NetShield 🛡️</h1>
        <p>Advanced DDoS & Intrusion Detection System</p>
      </header>

      <main className="container">
        <section className="upload-card">
          <h3>Traffic Analysis Control</h3>
          
          <div className="input-group">
            <label>Target Dataset:</label>
            <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
              <option value="sdn">Custom SDN (DDoS)</option>
              <option value="cicids">CICIDS-2017</option>
              <option value="nsl">NSL-KDD</option>
              <option value="ton">ToN IoT</option>
              <option value="ids2018">CSE-CIC-IDS 2018</option>
            </select>
          </div>

          <div className="input-group">
            <label>Model Brain:</label>
            <select value={modelType} onChange={(e) => setModelType(e.target.value)}>
              <option value="dl">Deep Learning (CNN/Hybrid)</option>
              <option value="ml">Machine Learning (RF/DT/XGB)</option>
            </select>
          </div>

          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
          
          <button onClick={handleUpload} disabled={loading}>
            {loading ? "Analyzing..." : "Run Detection"}
          </button>
        </section>

        {result && (
          <section className={`result-card ${result.prediction === 'Attack' ? 'alert' : 'safe'}`}>
            <h2>Analysis Result: {result.prediction}</h2>
            <div className="stats">
              <p>Confidence: {(result.confidence_score * 100).toFixed(2)}%</p>
              <p>Severity: {result.severity}</p>
            </div>
            <p className="message">{result.message}</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;