require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = 3000;

const API_KEY = process.env.SAMSARA_API_KEY;
const BASE_URL = 'https://api.eu.samsara.com';

const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || 'h0lYfl44t';
const AUTH_TOKEN = crypto.createHash('sha256').update(AUTH_USER + ':' + AUTH_PASS).digest('hex').substring(0, 32);

app.use((req, res, next) => {
  // Check session cookie first
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=');
    if (k) acc[k] = v;
    return acc;
  }, {});
  if (cookies.hft_session === AUTH_TOKEN) return next();

  // Fall back to Basic auth
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const idx = decoded.indexOf(':');
    const user = decoded.substring(0, idx);
    const pass = decoded.substring(idx + 1);
    if (user === AUTH_USER && pass === AUTH_PASS) {
      res.cookie('hft_session', AUTH_TOKEN, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
      return next();
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="Holcim Fleet Tracking"');
  res.status(401).send('Authentication required');
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Dashboard cache
let dashboardCache = { data: null, timestamp: null };

async function refreshDashboardCache() {
  try {
    const headers = {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    };

    const [vehiclesRes, statsRes, locationsRes] = await Promise.all([
      axios.get(`${BASE_URL}/fleet/vehicles`, { headers }),
      axios.get(`${BASE_URL}/fleet/vehicles/stats`, { headers, params: { types: 'engineStates' } }),
      axios.get(`${BASE_URL}/fleet/vehicles/locations`, { headers }),
    ]);

    const vehiclesList = (vehiclesRes.data.data) || [];
    const statsList = (statsRes.data.data) || [];
    const locationsList = (locationsRes.data.data) || [];

    // Index stats by vehicle ID
    const statsMap = {};
    statsList.forEach(s => {
      const engineStates = s.engineState || s.engineStates || [];
      const latest = Array.isArray(engineStates) ? engineStates[0] : engineStates;
      statsMap[s.id] = {
        state: latest ? (latest.value || '').toUpperCase() : null,
        time: latest ? latest.time : null,
      };
    });

    // Index locations by vehicle ID
    const locMap = {};
    locationsList.forEach(l => {
      const loc = l.location || {};
      locMap[l.id] = {
        lat: loc.latitude,
        lng: loc.longitude,
        speed: loc.speedMilesPerHour || loc.speed || 0,
        address: (loc.reverseGeo && loc.reverseGeo.formattedLocation) || '',
        time: loc.time || null,
      };
    });

    // Merge into single array
    const vehicles = vehiclesList.map(v => {
      const id = v.id;
      const stat = statsMap[id] || {};
      const loc = locMap[id] || {};
      const driver = v.staticAssignedDriver;
      return {
        id,
        name: v.name || '--',
        plate: v.licensePlate || '--',
        make: v.make || '',
        model: v.model || '',
        makeModel: [v.make, v.model].filter(Boolean).join(' ') || '--',
        driverId: driver ? driver.id : null,
        driver: driver ? driver.name || (driver.firstName || '') + ' ' + (driver.lastName || '') : '--',
        status: stat.state === 'ON' ? 'Running' : stat.state === 'OFF' ? 'Stopped' : 'Unknown',
        statusRaw: stat.state || '',
        engineTime: stat.time || null,
        lat: loc.lat,
        lng: loc.lng,
        location: loc.address || '--',
        locTime: loc.time || null,
      };
    });

    dashboardCache = { data: vehicles, timestamp: new Date().toISOString() };
    console.log(`[cache] Dashboard refreshed: ${vehicles.length} vehicles at ${dashboardCache.timestamp}`);
  } catch (err) {
    console.error('[cache] Failed to refresh dashboard:', err.message);
  }
}

// Lightweight timestamp check for clients to detect cache updates
app.get('/api/dashboard/timestamp', (req, res) => {
  res.json({ timestamp: dashboardCache.timestamp });
});

// Serve cached dashboard data (refresh=true triggers a fresh Samsara fetch first)
app.get('/api/dashboard', async (req, res) => {
  if (req.query.refresh === 'true') {
    await refreshDashboardCache();
  }
  if (!dashboardCache.data) {
    return res.status(503).json({ error: 'Dashboard cache not ready yet' });
  }
  res.json({ data: dashboardCache.data, timestamp: dashboardCache.timestamp });
});

// Proxy all requests to Samsara
app.get('/api/proxy', async (req, res) => {
  const endpoint = req.query.endpoint;
  const params = { ...req.query };
  delete params.endpoint;

  if (!endpoint) {
    return res.status(400).json({ error: 'No endpoint specified' });
  }

  const startTime = Date.now();

  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      params,
    });

    const duration = Date.now() - startTime;
    res.json({
      status: response.status,
      duration,
      data: response.data,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    const status = err.response?.status || 500;
    res.status(status).json({
      status,
      duration,
      error: err.response?.data || { message: err.message },
    });
  }
});

app.listen(PORT, () => {
  console.log(`\nHolcim Fleet Tracking — Samsara API Explorer`);
  console.log(`Running at: http://localhost:${PORT}\n`);

  // Initial cache fetch + refresh every 60s
  refreshDashboardCache();
  setInterval(refreshDashboardCache, 60000);
});
