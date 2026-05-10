import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import './App.css';
import Layout from './layout/Layout';
import UploadPage from './pages/UploadPage';
import ManualProbe from './pages/ManualProbe';
import HistoryPage from './pages/HistoryPage';
import LiveMap from './pages/LiveMap';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import { useAuth } from './context/AuthContext';
import AgentBot from './pages/AgentBot';
import DashboardOverview from './pages/DashboardOverview';

function RequireAuth({ children }) {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route element={<Layout><RequireAuth><Outlet /></RequireAuth></Layout>}>
          <Route path="/dashboard" element={<Navigate to="/dashboard/overview" replace />} />
          <Route path="/dashboard/overview" element={<DashboardOverview />} />
          <Route path="/dashboard/upload" element={<UploadPage />} />
          <Route path="/dashboard/manual-probe" element={<ManualProbe />} />
          <Route path="/dashboard/history" element={<HistoryPage />} />
          <Route path="/dashboard/live-map" element={<LiveMap />} />
          <Route path="/dashboard/agent" element={<AgentBot />} />
          <Route path="/dashboard/profile" element={<Profile />} />
          <Route path="/dashboard/settings" element={<Profile />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard/overview" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
