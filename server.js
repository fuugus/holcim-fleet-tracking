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
});
