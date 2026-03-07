const rawBase =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:9091';

// Ensure no trailing slash
export const API_BASE = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
