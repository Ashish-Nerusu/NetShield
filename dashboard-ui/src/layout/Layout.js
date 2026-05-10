import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Shield, Activity, ShieldAlert, Map, Bot, Settings, HelpCircle, Bell, Search, User as UserIcon, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      
      {/* TOPBAR */}
      <header className="topbar">
        <div className="topbar-left">
          <button aria-label="menu" className="hamburger" onClick={() => setCollapsed(!collapsed)}>
            <Menu size={20} />
          </button>
          <div className="brand-title">
            <Shield size={24} color="var(--color-primary)" />
            NetShield
          </div>
        </div>
        
        <div className="topbar-right">
          <div className="global-search">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search threats, logs, IP..." />
          </div>
          
          {isLoggedIn ? (
            <>
              <button className="hamburger" style={{ border: 'none' }} title="Notifications">
                <Bell size={20} />
              </button>
              
              <div className="profile-dropdown-container">
                <button className="profile-trigger" onClick={() => setMenuOpen(!menuOpen)}>
                  <div className="profile-avatar-small">
                    {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                </button>
                
                {menuOpen && (
                  <div className="profile-dropdown-menu">
                    <div className="dropdown-header">
                      <div className="dropdown-header-name">{user?.username || 'User'}</div>
                      <div className="dropdown-header-role">Security Analyst</div>
                    </div>
                    <div className="dropdown-item" onClick={() => { setMenuOpen(false); navigate('/dashboard/profile'); }}>
                      <UserIcon size={16} /> View Profile
                    </div>
                    <div className="dropdown-item" onClick={() => { setMenuOpen(false); navigate('/dashboard/settings'); }}>
                      <Settings size={16} /> Account Settings
                    </div>
                    <div className="dropdown-item" onClick={() => { setMenuOpen(false); navigate('/dashboard/history'); }}>
                      <Bell size={16} /> Notifications
                    </div>
                    <div className="dropdown-item" onClick={() => setMenuOpen(false)}>
                      <HelpCircle size={16} /> Help & Support
                    </div>
                    <div className="dropdown-item danger" onClick={() => { setMenuOpen(false); logout(); navigate('/login'); }}>
                      <LogOut size={16} /> Logout
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link to="/login" className="btn btn-secondary">Login</Link>
              <Link to="/signup" className="btn btn-primary">Signup</Link>
            </div>
          )}
        </div>
      </header>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Primary</div>
            <Link className={`sidebar-link ${location.pathname === '/dashboard/overview' ? 'active' : ''}`} to="/dashboard/overview">
              <LayoutDashboard size={20} /> <span>Dashboard</span>
            </Link>
            <Link className={`sidebar-link ${location.pathname === '/dashboard/upload' ? 'active' : ''}`} to="/dashboard/upload">
              <Shield size={20} /> <span>Automated Shield</span>
            </Link>
            <Link className={`sidebar-link ${location.pathname === '/dashboard/manual-probe' ? 'active' : ''}`} to="/dashboard/manual-probe">
              <Activity size={20} /> <span>Manual Probe</span>
            </Link>
          </div>
          
          <div className="sidebar-section">
            <div className="sidebar-section-title">Monitoring</div>
            <Link className={`sidebar-link ${location.pathname === '/dashboard/history' ? 'active' : ''}`} to="/dashboard/history">
              <ShieldAlert size={20} /> <span>Threat Intelligence</span>
            </Link>
            <Link className={`sidebar-link ${location.pathname === '/dashboard/live-map' ? 'active' : ''}`} to="/dashboard/live-map">
              <Map size={20} /> <span>Live Map</span>
            </Link>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Intelligence</div>
            <Link className={`sidebar-link ${location.pathname === '/dashboard/agent' ? 'active' : ''}`} to="/dashboard/agent">
              <Bot size={20} /> <span>Agent Bot</span>
            </Link>
          </div>

          <div className="sidebar-section" style={{ marginTop: 'auto' }}>
            <div className="sidebar-section-title">System</div>
            <Link className={`sidebar-link ${location.pathname === '/dashboard/settings' ? 'active' : ''}`} to="/dashboard/settings">
              <Settings size={20} /> <span>Settings</span>
            </Link>
          </div>
        </div>
        
        {isLoggedIn && !collapsed && (
          <div className="sidebar-profile">
            <div className="profile-avatar-small" style={{ width: 40, height: 40, fontSize: '1rem' }}>
              {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{user?.username || 'User'}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-success)' }}></span> Online
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* CONTENT */}
      <main className="content">{children}</main>
    </div>
  );
}

export default Layout;
