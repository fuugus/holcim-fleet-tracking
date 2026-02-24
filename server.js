const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

const API_KEY = 'REDACTED';
const BASE_URL = 'https://api.eu.samsara.com';

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
