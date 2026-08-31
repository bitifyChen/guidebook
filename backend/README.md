# Guidebook Backend

Render-hosted lightweight backend for Guidebook.

## Endpoints

- `GET /health`
- `GET /website/health`
- `GET|POST /tracking/traccar`
- `GET|POST /api/tracking/traccar`
- `POST /notifications/send`
- `POST /api/notifications/send`
- `POST /maps/resolve-route`
- `POST /api/maps/resolve-route`
- `GET /admin/location-tracks`
- `POST /admin/location-tracks/delete-preview`
- `POST /admin/location-tracks/delete`
- `GET /location-tracks/archive`
- `POST /maintenance/location-track-archive`

`/tracking/traccar` accepts query string, form body, or JSON payload.
`/notifications/send` and `/maps/resolve-route` require a Firebase ID token in
the `Authorization` header. The token owner must map to an admin or super admin
participant. The map resolver only accepts supported Google Maps HTTPS links.
The admin location-track endpoints use the same Firebase admin authentication.
They read or delete both the RTDB buffer and matching Firestore archive segments,
then write deletion audit records to Firestore. Clearing history does not disable
tracking or remove the current location, tracking token, track state, or gathering
points.

Required:

- `token`
- `lat` or `latitude`
- `lon`, `lng`, or `longitude`

Optional:

- `id` / `deviceId`
- `timestamp` / `time` / `ts`
- `accuracy` / `acc`
- `battery` / `batt` / `bat`
- `speed` / `spd`

## Firebase Data Contract

Tracking tokens are stored in Firestore:

```text
trackingTokens/{sha256(token)}
```

Example:

```json
{
  "participantId": "participant-id",
  "tripId": "active-trip-id",
  "deviceId": "optional-device-id",
  "enabled": true,
  "minIntervalSeconds": 30,
  "historyEnabled": true,
  "historyMinDistanceMeters": 15,
  "historyHeartbeatSeconds": 300
}
```

Current locations are written to Realtime Database:

```text
tripLocations/{tripId}/{participantId}
```

The backend resolves `participants/{participantId}.tripIds` at upload time and
writes the current device location to the participant's trips for backward
compatibility. Historical points are written only to the token's active
`tripId`, or to the participant's only trip when no active trip was recorded.
The PWA keeps the token's active trip in sync when the member switches trips.

Historical tracks are stored separately in Realtime Database:

```text
tripLocationTracks/{tripId}/{participantId}/{pointId}
trackingTrackState/{tripId}/{participantId}
```

History records a point after at least 15 meters of movement, or a five-minute
heartbeat while stationary. A manual PWA location update always records a
history point for the current trip.

Realtime Database is the live and recent-history buffer. The scheduled archive
job keeps at least 48 hours of raw points, then stores completed local dates as
compressed Firestore documents:

```text
participantTrackArchives/{participantId}/days/{YYYY-MM-DD}
```

Each document uses `gzip-json-v1` in a Firestore Bytes field and may contain one
segment per `tripId`. Before saving, the archive removes invalid coordinates,
duplicates, isolated GPS spikes, and redundant stationary heartbeats while
preserving stop arrival/departure anchors. It reads the saved document back and
verifies its checksum before deleting the exact RTDB point IDs.

The frontend API remains unchanged. Recent dates read RTDB; older dates read the
archive endpoint and are cached in IndexedDB. If an archive does not exist yet,
the frontend falls back to RTDB.

Gathering points for a trip are stored in Realtime Database:

```text
tripGatheringPins/{tripId}/{pinId}
```

Push notification history is written to Firestore:

```text
notificationLogs/{logId}
```

Admin history deletion audits are written to Firestore:

```text
locationTrackDeletionLogs/{logId}
```

The backend sends FCM through the Firebase Admin SDK and records success and
failure counts in the log document.

## Render Setup

Option A: use the repo-level `render.yaml` Blueprint.

Option B: create a Web Service manually:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app`

Environment variables:

- `FIREBASE_RTDB_URL`
- `FIREBASE_CREDENTIALS_PATH` (optional when the Render Secret File is named `firebase.json`)
- `CORS_ALLOWED_ORIGINS`
- `MAINTENANCE_API_TOKEN`

Optional archive tuning:

- `TRACK_ARCHIVE_BUFFER_HOURS` (default `48`)
- `TRACK_ARCHIVE_MAX_ARCHIVES` (default `200` per run)

Default allowed browser origins include local Vite development URLs and Firebase
Hosting:

- `https://guidebook-jeju.web.app`
- `https://guidebook-jeju.firebaseapp.com`
- `https://guidebook.chenchenworkshop.com`

Add custom domains or temporary ngrok domains to `CORS_ALLOWED_ORIGINS` as a
comma-separated list.

## Render Secret File

Use Render Secret Files for the Firebase service account:

- Secret file name: `firebase.json`
- Mount path: `/etc/secrets/firebase.json`
- Environment variable:

```text
FIREBASE_CREDENTIALS_PATH=/etc/secrets/firebase.json
```

If `FIREBASE_CREDENTIALS_PATH` is not set, the backend will still try
`/etc/secrets/firebase.json` and then `firebase.json` before failing.

Do not commit the service account JSON into this repository.

## Daily Track Archive

Schedule the archive request for `00:00 Asia/Taipei`, which is `16:00 UTC` on
the previous calendar date:

```text
0 16 * * *
```

Send a server-side request to the deployed backend:

```bash
curl -X POST \
  -H "Authorization: Bearer $MAINTENANCE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxArchives":200}' \
  https://guidebook-ckce.onrender.com/maintenance/location-track-archive
```

Generate a long random token and set the same value in Render and the scheduler.
Do not place this secret in the frontend. Add `"dryRun": true` to inspect eligible
data without writing or deleting anything.

Because the job runs once per day and only archives complete dates older than
the 48-hour cutoff, actual RTDB retention is normally between 48 and 72 hours.
The schedule is always Taiwan time; each archived segment still records the
trip timezone used to determine its local calendar date.
