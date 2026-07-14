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
  "deviceId": "optional-device-id",
  "enabled": true,
  "minIntervalSeconds": 30
}
```

Current locations are written to Realtime Database:

```text
tripLocations/{tripId}/{participantId}
```

The backend resolves `participants/{participantId}.tripIds` at upload time and
writes the same device location to every trip the participant belongs to.

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
