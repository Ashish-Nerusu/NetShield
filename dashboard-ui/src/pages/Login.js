import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, api } from '../context/AuthContext';

function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login: setAuth } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!login || !password) {
      setError('Both fields are required');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/api/auth/login`, { username: login, password });
      const userObj = { username: res.data.username, role: res.data.role };
      setAuth(res.data.token, userObj);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      const errorData = e.response && e.response.data;
      const errorMsg = typeof errorData === 'string' ? errorData : (errorData && errorData.detail) || e.message;
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', backgroundColor: 'var(--color-bg-canvas)' }}>
      <div className="card" style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-4)' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>🛡️ NetShield</div>
          <div style={{ color: 'var(--color-text-secondary)' }}>Secure Login</div>
        </div>
        {error && <div style={{ background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '8px 12px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-4)', fontSize: '0.875rem' }}>{error}</div>}
        <form onSubmit={submit}>
          <div className="input-group"><label className="input-label">Username or Email</label><input className="input-field" value={login} onChange={(e) => setLogin(e.target.value)} disabled={loading} /></div>
          <div className="input-group"><label className="input-label">Password</label><input className="input-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} /></div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 'var(--spacing-3)' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div style={{ marginTop: 'var(--spacing-3)', textAlign: 'center' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Don’t have an account? </span>
          <a href="/signup">Sign up</a>
        </div>
      </div>
    </div>
  );
}

export default Login;
