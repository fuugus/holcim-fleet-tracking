# Samsara API — GET Endpoints Reference

Source: https://developers.samsara.com/reference
Base URL: https://api.eu.samsara.com

Legend:
- [x] = in our app
- [ ] = not in our app yet

## Organization

- [x] `GET /me` — Current org and user info
- [x] `GET /users` — List all users
- [x] `GET /user-roles` — List all user roles
- [ ] `GET /users/{id}` — Retrieve a single user
- [x] `GET /contacts` — List all contacts
- [ ] `GET /contacts/{id}` — Retrieve a single contact
- [x] `GET /tags` — List all tags
- [ ] `GET /tags/{id}` — Retrieve a single tag
- [x] `GET /addresses` — List all addresses/geofences
- [ ] `GET /addresses/{id}` — Retrieve a single address
- [x] `GET /attributes` — List attributes. Params: `entityType` (required: Vehicle, Driver, etc.)
- [x] `GET /gateways` — List all gateways (telematics devices)

## Fleet — Vehicles

- [x] `GET /fleet/vehicles` — List all vehicles
- [ ] `GET /fleet/vehicles/{id}` — Retrieve a single vehicle
- [x] `GET /fleet/vehicles/locations` — Current GPS locations for all vehicles
- [ ] `GET /fleet/vehicles/locations/feed` — Vehicle locations feed (polling)
- [x] `GET /fleet/vehicles/stats` — Vehicle stats snapshot. Params: `types` (required, e.g. engineStates, gps, fuelPercents, obdOdometerMeters, engineRpm, batteryMilliVolts)
- [ ] `GET /fleet/vehicles/stats/feed` — Vehicle stats feed (polling). Params: `types` (required)
- [x] `GET /fleet/vehicles/stats/history` — Historical vehicle stats. Params: `types` (required), `startTime`, `endTime` (required, ISO 8601)

## Fleet — Trailers (documented, 404 on EU instance)

- [x] `GET /trailers` — List all trailers
- [x] `GET /trailers/locations` — Current GPS locations for all trailers
- [x] `GET /trailers/{id}` — Retrieve a single trailer
- [x] `GET /trailers/stats` — Trailer stats snapshot. Params: `types` (required)
- [x] `GET /trailers/stats/history` — Historical trailer stats. Params: `types`, `startTime`, `endTime`

## Fleet — Drivers

- [x] `GET /fleet/drivers` — List all drivers
- [ ] `GET /fleet/drivers/{id}` — Retrieve a single driver
- [x] `GET /fleet/drivers/locations` — Current locations of drivers

## Fleet — HOS (Hours of Service)

- [x] `GET /fleet/hos/logs` — HOS logs for all drivers
- [x] `GET /fleet/hos/daily-logs` — Daily HOS summary logs. Params: `startDate`, `endDate` (required, YYYY-MM-DD)
- [x] `GET /fleet/hos/clocks` — Current HOS duty clocks
- [x] `GET /fleet/hos/violations` — HOS violations. Params: `startTime`, `endTime` (required, ISO 8601)

## Fleet — Safety

- [x] `GET /fleet/safety-events` — Safety events. Note: requires "Safety Events & Scores read" permission on API token
- [ ] `GET /fleet/safety-events/{id}` — Retrieve a single safety event

## Fleet — Trips

- [x] `GET /fleet/trips` — Trip history for vehicles (documented, 404 on EU)

## Assets (unified v2)

- [x] `GET /assets` — List all assets (vehicles, trailers, equipment)
- [ ] `GET /assets/{id}` — Retrieve a single asset
- [x] `GET /assets/locations` — Current GPS locations for all assets (documented, 404 on EU)

## Equipment (documented, 404 on EU instance)

- [x] `GET /equipment` — List all equipment
- [ ] `GET /equipment/{id}` — Retrieve a single unit of equipment
- [x] `GET /equipment/locations` — Current locations of all equipment
- [x] `GET /equipment/stats` — Equipment stats snapshot. Params: `types` (required)
- [x] `GET /equipment/stats/history` — Historical equipment stats. Params: `types`, `startTime`, `endTime`

## Industrial Assets

- [x] `GET /industrial/assets` — List all industrial assets
- [x] `GET /industrial/assets/locations` — Current locations (returns 405 on EU)
- [x] `GET /industrial/assets/stats` — Stats for industrial assets (returns 405 on EU)

## Documents & DVIR

- [ ] `GET /dvirs` — Stream DVIRs (note: /fleet/dvirs returns 405)
- [ ] `GET /dvirs/{id}` — Get a single DVIR
- [x] `GET /defects` — Stream DVIR defects (documented, 404 on EU)
- [ ] `GET /defects/{id}` — Get a single defect
- [x] `GET /fleet/documents` — Fleet documents. Params: `startTime`, `endTime` (required, ISO 8601)
- [x] `GET /fleet/document-types` — Available document type templates

## Alerts

- [x] `GET /alerts/configurations` — Alert configuration rules
- [ ] `GET /alerts/incidents` — Alert incidents (documented, 404 on EU with both /incidents and /instances)

## Routes (documented, 404 on EU instance)

- [x] `GET /routes` — List all dispatch routes
- [ ] `GET /routes/{id}` — Retrieve a single route

## Sensors (note: documented as POST-only endpoints)

- [x] `GET /sensors` — Listed in our app (404 on EU — docs say POST only)
- [x] `GET /sensors/history` — Listed in our app (404 on EU — docs say POST only)

## Webhooks

- [ ] `GET /webhooks` — List all webhooks
- [ ] `GET /webhooks/{id}` — Retrieve a single webhook

## NOT in Samsara docs (removed from app)

These were in the original app but do not appear in Samsara's API reference:
- `/route-templates`
- `/fleet/ifta/summary`
- `/fleet/driver-efficiency`
- `/fleet/messages`
- `/reports/drivers/speed`
- `/reports/vehicles/speed-percent-of-time`
- `/reports/vehicles/fuel-energy`
