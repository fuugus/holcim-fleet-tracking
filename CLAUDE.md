# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Holcim Fleet Tracking is a Samsara API Explorer — a web UI for browsing and testing Samsara fleet management API endpoints. It consists of a Node.js/Express proxy server and a single-page frontend.

## Commands

- **Start the server:** `npm start` (runs on http://localhost:3000)
- **Install dependencies:** `npm install`

There is no build step, no linter, and no test suite configured.

## Architecture

### Backend (`server.js`)
Express server with a single proxy endpoint (`GET /api/proxy`). It accepts an `endpoint` query parameter and forwards the request to the Samsara EU API (`api.eu.samsara.com`) with bearer token authentication. Additional query parameters are passed through to Samsara. Returns JSON with `status`, `duration`, and `data` fields.

### Frontend (`public/index.html`)
Self-contained single-page application with inline CSS and JavaScript (no framework, no build tooling). Features:
- Sidebar with categorized Samsara API endpoints defined in the `ENDPOINTS` array
- Search/filter for endpoints
- Sends requests through the backend proxy and displays syntax-highlighted JSON responses
- Endpoint definitions include `path`, `name`, `desc`, and optional `params` (default query parameters)

### Key Details
- The API key and base URL are hardcoded in `server.js` — the API key is also exposed in `README.md`
- All Samsara requests are GET-only, proxied through `/api/proxy?endpoint=/path&otherParams=...`
- No environment variable support; configuration changes require editing `server.js` directly
- Dependencies: `express` and `axios` only
