# Guidebook Backend

Render-hosted lightweight backend for Guidebook.

## Endpoints

- `GET /health`
- `GET /website/health`
- `GET|POST /tracking/traccar`
- `GET|POST /api/tracking/traccar`

`/tracking/traccar` accepts query string, form body, or JSON payload.

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
  "tripId": "trip-uuid",
  "participantId": "participant-id",
  "deviceId": "optional-device-id",
  "enabled": true,
  "minIntervalSeconds": 30
}
```

Current locations are written to Realtime Database:

```text
tripLocations/{tripId}/{participantId}
```

## Render Setup

Option A: use the repo-level `render.yaml` Blueprint.

Option B: create a Web Service manually:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app`

Environment variables:

- `FIREBASE_RTDB_URL`
- `FIREBASE_CREDENTIALS_PATH`
- `CORS_ALLOWED_ORIGINS`

## Render Secret File

Use Render Secret Files for the Firebase service account:

- Secret file name: `firebase.json`
- Mount path: `/etc/secrets/firebase.json`
- Environment variable:

```text
FIREBASE_CREDENTIALS_PATH=/etc/secrets/firebase.json
```

Do not commit the service account JSON into this repository.
