import axios from 'axios';

const DIRECT_BACKEND = 'http://127.0.0.1:8000/api';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const directClient = axios.create({
  baseURL: DIRECT_BACKEND,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const extractDetail = (err) => {
  if (!err) return null;
  if (err.response?.data?.detail) {
    const d = err.response.data.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((item) => item.msg || JSON.stringify(item)).join('; ');
    if (typeof d === 'object') return d.msg || d.message || JSON.stringify(d);
  }
  if (typeof err.response?.data === 'string') return err.response.data;
  if (err.response?.data?.message) return err.response.data.message;
  return null;
};

// Centralized error normalizer with automatic direct-backend fallback
const handleRequest = async (method, url, data = null) => {
  try {
    const response = await apiClient({ method, url, data });
    return { data: response.data, error: null, offline: false };
  } catch (err) {
    // If proxy failed with network error (and NOT a timeout), retry directly against backend port 8000
    const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
    if (!err.response && !isTimeout) {
      try {
        const fallbackRes = await directClient({ method, url, data });
        return { data: fallbackRes.data, error: null, offline: false };
      } catch (fallbackErr) {
        err = fallbackErr;
      }
    }

    const hasResponse = Boolean(err.response);
    const detailMessage = extractDetail(err);

    const message =
      detailMessage ||
      (isTimeout
        ? 'Traverse calculation timed out. The selected points are over 10 km apart across complex crater terrain. Please pick closer waypoints.'
        : !hasResponse
        ? 'Cannot connect to backend service. Ensure uvicorn is running on port 8000.'
        : `Navigation error (Status ${err.response?.status || 'Unknown'})`);

    return { data: null, error: message, offline: !hasResponse && !isTimeout };
  }
};

export const MarsWalkAPI = {
  // 1. Mission Database (SQLAlchemy SQLite)
  getMission: () => handleRequest('get', '/mission'),

  // 2. System Health & Data Readiness
  getHealth: () => handleRequest('get', '/health'),

  // 3. GIS Terrain Layers (5 m HiRISE Stereo Products)
  getNavigationLayers: () => handleRequest('get', '/navigation/layers'),

  // 4. Terrain GeoTIFF URL
  getTerrainRasterUrl: (layerName) => `/api/navigation/terrain/${layerName}.tif`,

  // 5. Science Targets (P6 Catalogue)
  getScienceTargets: () => handleRequest('get', '/science/targets'),

  // 6. Navigation Route Planning (P4 A* Algorithm)
  calculateRoute: (payload) => handleRequest('post', '/navigation/route', payload),

  // 7. Route Comparison (Shortest vs Safest)
  compareRoutes: (payload) => handleRequest('post', '/navigation/compare', payload),

  // 8. Feasibility Check
  checkFeasibility: (payload) => handleRequest('post', '/navigation/feasibility', payload),

  // 9. Science Observations (Authentic NASA PDS / Perseverance Records)
  getObservations: async () => {
    try {
      const res = await axios.get('/data/science/observations/observations.json');
      return { data: res.data.observations || [], error: null };
    } catch (err) {
      return { data: [], error: 'Could not load science observations catalog.' };
    }
  },

  // 10. MEDA Environmental Telemetry Summary (Authentic Sol 1 PDS Data)
  getMedaSummary: async () => {
    try {
      const res = await axios.get('/data/science/meda/processed/WE__0001___________DER_PS__________________P02_summary.json');
      return { data: res.data, error: null };
    } catch (err) {
      return { data: null, error: 'Could not load MEDA telemetry product.' };
    }
  },

  // 11. MOLA Global Elevation Metadata
  getMolaMetadata: async () => {
    try {
      const res = await axios.get('/mars-mola-elevation.json');
      return { data: res.data, error: null };
    } catch (err) {
      return { data: null, error: 'Could not load MOLA elevation metadata.' };
    }
  },
};
