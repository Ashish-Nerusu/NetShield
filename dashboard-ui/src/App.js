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
          <Route path="/dashboard" element={<UploadPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/manual" element={<ManualProbe />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/map" element={<LiveMap />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/agent" element={<AgentBot />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
