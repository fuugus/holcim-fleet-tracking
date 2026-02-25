# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Holcim Fleet Tracking is a Samsara API Explorer — a web UI for browsing Samsara fleet management API endpoints and a real-time fleet dashboard with map. It consists of a Node.js/Express proxy server and a single-page frontend.

**Read-only policy:** Only GET requests are used. No writes (POST, PATCH, DELETE) are allowed at any time.

## Commands

- **Install dependencies:** `npm install`
- **Start the server:** `npm start` (runs on http://localhost:3000)

There is no build step, no linter, and no test suite.

## Architecture

### Backend (`server.js`)
- Express server with a single proxy endpoint (`GET /api/proxy`) that forwards requests to the Samsara EU API (`api.eu.samsara.com`) with bearer token auth
- Accepts `endpoint` query parameter plus pass-through query params. Returns JSON with `status`, `duration`, and `data` fields
- HTTP Basic authentication middleware with session cookie (`hft_session`) to avoid repeated prompts. Credentials configured via `AUTH_USER`/`AUTH_PASS` env vars
- Samsara API key loaded from `SAMSARA_API_KEY` env var (see `.env.example`). All config via `.env` file (dotenv)
- Dependencies: `express`, `axios`, `dotenv`

### Frontend (`public/index.html`)
Single self-contained HTML file with all CSS and JS inline (no framework, no build tooling). Two tabs:

1. **Dashboard tab** — Real-time fleet overview with vehicle table and MapLibre GL JS map centered on Switzerland. Shows vehicle status, location, fuel, odometer. Clicking a vehicle opens a detail panel with trips, HOS, safety events, and DVIRs loaded from the API.

2. **API Explorer tab** — Sidebar with categorized Samsara endpoints defined in the `ENDPOINTS` array (~line 1639). Search/filter, parameter editing, and syntax-highlighted JSON responses.

### Key Frontend Patterns
- All API calls go through `fetchJson()` which hits `/api/proxy?endpoint=/path`
- Vehicle data stored in `dashVehicles` array, refreshed by `loadDashboard()`
- Map uses MapLibre GL with a dark-themed vector tile style (built by `buildDarkStyle()`) and Swiss border GeoJSON overlay
- Vehicle selection/deselection: `selectVehicle(id)` / `deselectVehicle()` — highlights table row, flies map to vehicle, shows detail panel
