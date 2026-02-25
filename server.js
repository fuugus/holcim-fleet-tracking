require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

const API_KEY = process.env.SAMSARA_API_KEY;
const BASE_URL = 'https://api.eu.samsara.com';

const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || 'h0lYfl44t';

app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Holcim Fleet Tracking"');
    return res.status(401).send('Authentication required');
  }
  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  if (user === AUTH_USER && pass === AUTH_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Holcim Fleet Tracking"');
  res.status(401).send('Invalid credentials');
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
