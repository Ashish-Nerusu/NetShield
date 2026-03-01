import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../shared/api';

// Create axios instance
const api = axios.create({ baseURL: API_BASE });

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('netshield_token') || '');
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('netshield_user');
    try { 
      return u ? JSON.parse(u) : null; 
    } catch { 
      return null; 
    }
  });

  const isLoggedIn = !!token;

  // Attach token automatically to every request
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = (nextToken, nextUser) => {
    localStorage.setItem('netshield_token', nextToken);
    localStorage.setItem('netshield_user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem('netshield_token');
    localStorage.removeItem('netshield_user');
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoggedIn, login, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
