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

// Detail cache (trips, HOS, DVIRs)
let detailCache = { trips: {}, hos: {}, dvirs: {} };
let prevEngineTime = {};
let isFirstDetailRun = true;

const samsaraHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

// Run async tasks with concurrency limit
async function parallelLimit(tasks, limit) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = task().then(r => { executing.delete(p); return r; });
    executing.add(p);
    results.push(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}

async function refreshDetailCache(fullRefresh) {
  if (!dashboardCache.data || dashboardCache.data.length === 0) return;
  const start = Date.now();

  try {
    // Step 1: HOS + DVIRs in parallel (bulk endpoints)
    const driverIds = [...new Set(dashboardCache.data.filter(v => v.driverId).map(v => v.driverId))];
    const now = Date.now();
    const ninetyAgo = now - 90 * 86400000;
    const oneEightyAgo = now - 180 * 86400000;

    const bulkPromises = [];

    // HOS — single bulk call
    if (driverIds.length > 0) {
      bulkPromises.push(
        axios.get(`${BASE_URL}/fleet/hos/clocks`, {
          headers: samsaraHeaders,
          params: { driverIds: driverIds.join(',') },
        }).then(res => {
          const clocks = (res.data.data) || [];
          clocks.forEach(c => {
            const did = c.driver && c.driver.id;
            if (!did) return;
            const status = c.currentDutyStatus || {};
            const cl = c.clocks || {};
            detailCache.hos[did] = {
              statusType: status.hosStatusType || null,
              hasClocks: !!(cl.drive || cl.shift || cl.cycle || cl.break),
              raw: c,
            };
          });
          return clocks.length;
        }).catch(() => 0)
      );
    }

    // DVIRs — two 90-day calls in parallel
    bulkPromises.push(
      Promise.all([
        axios.get(`${BASE_URL}/v1/fleet/maintenance/dvirs`, {
          headers: samsaraHeaders,
          params: { startMs: ninetyAgo, endMs: now },
        }).catch(() => ({ data: { dvirs: [] } })),
        axios.get(`${BASE_URL}/v1/fleet/maintenance/dvirs`, {
          headers: samsaraHeaders,
          params: { startMs: oneEightyAgo, endMs: ninetyAgo },
        }).catch(() => ({ data: { dvirs: [] } })),
      ]).then(([r1, r2]) => {
        const all = [...(r1.data.dvirs || []), ...(r2.data.dvirs || [])];
        // Reset and rebuild per-vehicle
        detailCache.dvirs = {};
        all.forEach(d => {
          const vid = d.vehicle && String(d.vehicle.id);
          if (!vid) return;
          if (!detailCache.dvirs[vid]) detailCache.dvirs[vid] = { count: 0, lastTime: 0, items: [] };
          detailCache.dvirs[vid].count++;
          detailCache.dvirs[vid].items.push(d);
          if (d.timeMs > detailCache.dvirs[vid].lastTime) detailCache.dvirs[vid].lastTime = d.timeMs;
        });
        return all.length;
      })
    );

    const [hosCount, dvirCount] = await Promise.all(bulkPromises);

    // Step 2: Trips (per-vehicle with concurrency limit)
    const weekAgo = now - 7 * 86400000;
    let vehiclesToFetch;
    if (fullRefresh) {
      vehiclesToFetch = dashboardCache.data;
    } else {
      vehiclesToFetch = dashboardCache.data.filter(v => {
        return v.engineTime !== prevEngineTime[v.id];
      });
    }

    const tripTasks = vehiclesToFetch.map(v => () =>
      axios.get(`${BASE_URL}/v1/fleet/trips`, {
        headers: samsaraHeaders,
        params: { vehicleId: v.id, startMs: weekAgo, endMs: now },
      }).then(res => {
        const trips = (res.data.trips) || [];
        detailCache.trips[v.id] = {
          count: trips.length,
          lastTripEnd: trips.length > 0 ? trips[0].endMs || 0 : 0,
          items: trips,
        };
      }).catch(() => {
        if (!detailCache.trips[v.id]) detailCache.trips[v.id] = { count: 0, lastTripEnd: 0, items: [] };
      })
    );

    await parallelLimit(tripTasks, 30);

    // Update prevEngineTime for next delta check
    dashboardCache.data.forEach(v => { prevEngineTime[v.id] = v.engineTime; });

    const elapsed = Date.now() - start;
    console.log(`[detail] HOS: ${hosCount || 0}, DVIRs: ${dvirCount || 0}, Trips: ${vehiclesToFetch.length}/${dashboardCache.data.length} fetched (${elapsed}ms)`);
  } catch (err) {
    console.error('[detail] Failed to refresh detail cache:', err.message);
  }
}

async function refreshDashboardCache(fullDetailRefresh) {
  try {
    const [vehiclesRes, statsRes, locationsRes] = await Promise.all([
      axios.get(`${BASE_URL}/fleet/vehicles`, { headers: samsaraHeaders }),
      axios.get(`${BASE_URL}/fleet/vehicles/stats`, { headers: samsaraHeaders, params: { types: 'engineStates' } }),
      axios.get(`${BASE_URL}/fleet/vehicles/locations`, { headers: samsaraHeaders }),
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

    // Refresh detail cache (full on first run or manual refresh)
    const doFull = isFirstDetailRun || fullDetailRefresh;
    await refreshDetailCache(doFull);
    isFirstDetailRun = false;
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
    await refreshDashboardCache(true);
  }
  if (!dashboardCache.data) {
    return res.status(503).json({ error: 'Dashboard cache not ready yet' });
  }
  // Merge detail indicators into vehicle data
  const data = dashboardCache.data.map(v => {
    const trip = detailCache.trips[v.id];
    const hos = v.driverId ? detailCache.hos[v.driverId] : null;
    const dvir = detailCache.dvirs[v.id];
    return {
      ...v,
      tripCount: trip ? trip.count : 0,
      trips: trip ? trip.items.slice(0, 5) : [],
      hosStatus: hos ? hos.statusType : null,
      hasHOS: !!(hos && hos.statusType),
      hosData: hos ? hos.raw : null,
      dvirCount: dvir ? dvir.count : 0,
      dvirs: dvir ? dvir.items.slice(0, 5) : [],
    };
  });
  res.json({ data, timestamp: dashboardCache.timestamp });
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
