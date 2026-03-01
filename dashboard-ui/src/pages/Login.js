import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../shared/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login: setAuth } = useAuth();

  const submit = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, { username: login, password });
      setAuth(res.data.token, res.data.user);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      alert((e.response && e.response.data) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0d1117' }}>
      <div style={{
        width: 380, padding: 24, borderRadius: 16,
        background: 'rgba(31,35,40,0.7)', backdropFilter: 'blur(6px)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)', border: '1px solid #2e3440'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 28 }}>🛡️ NetShield</div>
          <div style={{ color: '#8b949e' }}>Secure Login</div>
        </div>
        <div className="input-group"><label>Username or Email</label><input value={login} onChange={(e) => setLogin(e.target.value)} /></div>
        <div className="input-group"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button onClick={submit} disabled={loading} style={{ width: '100%', marginTop: 12 }}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <span style={{ color: '#8b949e' }}>Don’t have an account? </span>
          <a href="/signup">Sign up</a>
        </div>
      </div>
    </div>
  );
}

export default Login;
