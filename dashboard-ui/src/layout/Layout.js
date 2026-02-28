import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './layout.css';
import { useAuth } from '../context/AuthContext';

function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <header className="topbar">
        <button aria-label="menu" className="hamburger" onClick={() => setCollapsed(!collapsed)}>☰</button>
        <span className="title">🛡️ NetShield</span>
        <span style={{ marginLeft: 'auto' }}>
          {isLoggedIn ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
                <span style={{ marginRight: 8, fontWeight: 600 }}>{user?.username || 'User'}</span>
                <span style={{ display: 'inline-block', width: 24, height: 24, borderRadius: 12, background: '#3fb950' }}></span>
              </button>
              {menuOpen && (
                <div style={{ position: 'absolute', right: 0, top: '100%', background: '#1f2328', border: '1px solid #2e3440', borderRadius: 8, padding: 8, zIndex: 10 }}>
                  <div style={{ padding: '6px 10px', cursor: 'pointer' }} onClick={() => { setMenuOpen(false); navigate('/profile'); }}>View Profile</div>
                  <div style={{ padding: '6px 10px', cursor: 'pointer' }} onClick={() => { setMenuOpen(false); navigate('/settings'); }}>Account Settings</div>
                  <div style={{ padding: '6px 10px', cursor: 'pointer', color: '#f85149' }} onClick={() => { setMenuOpen(false); logout(); navigate('/login'); }}>Logout</div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <Link to="/login" style={{ color: '#c0c7d1', marginRight: 12 }}>Login</Link>
              <Link to="/signup" style={{ color: '#c0c7d1' }}>Signup</Link>
            </div>
          )}
        </span>
      </header>
      <aside className="sidebar">
        <nav>
          <Link className={location.pathname === '/upload' ? 'active' : ''} to="/upload">Automated Shield</Link>
          <Link className={location.pathname === '/manual' ? 'active' : ''} to="/manual">Manual Probe</Link>
          <Link className={location.pathname === '/history' ? 'active' : ''} to="/history">Threat Intelligence</Link>
          <Link className={location.pathname === '/map' ? 'active' : ''} to="/map">Live Map</Link>
          <Link className={location.pathname === '/profile' ? 'active' : ''} to="/profile">Profile</Link>
          <Link className={location.pathname === '/agent' ? 'active' : ''} to="/agent">Agent Bot</Link>
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export default Layout;
