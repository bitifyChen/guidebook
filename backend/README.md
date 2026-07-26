# Guidebook Backend

Render-hosted lightweight backend for Guidebook.

## Endpoints

- `GET /health`
- `GET /website/health`
- `GET|POST /tracking/traccar`
- `GET|POST /api/tracking/traccar`
- `POST /notifications/send`
- `POST /api/notifications/send`

`/tracking/traccar` accepts query string, form body, or JSON payload.
`/notifications/send` requires a Firebase ID token in the `Authorization`
header. The token owner must map to an admin or super admin participant.

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

Gathering points for a trip are stored in Realtime Database:

```text
tripGatheringPins/{tripId}/{pinId}
```

Push notification history is written to Firestore:

```text
notificationLogs/{logId}
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
