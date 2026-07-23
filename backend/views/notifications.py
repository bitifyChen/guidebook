from firebase_admin import auth, firestore, messaging

from common.firebase import get_firebase_app, get_firestore_client


SUPER_ADMIN_UIDS = {"nJ4o0KAJUhdZ9eIYXSapIMfe74z2"}


def _json_error(message, status=400):
    return {"status": "error", "message": message}, status


def _request_json(request):
    return request.get_json(silent=True) or {}


def _verify_admin(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None, "Missing authorization token"

    token = header.replace("Bearer ", "", 1).strip()
    if not token:
        return None, "Missing authorization token"

    decoded = auth.verify_id_token(token, app=get_firebase_app())
    uid = decoded.get("uid")
    if not uid:
        return None, "Invalid authorization token"

    if uid in SUPER_ADMIN_UIDS:
        return {"uid": uid, "name": decoded.get("name") or decoded.get("email") or "Admin"}, None

    snapshots = get_firestore_client().collection("participants").where("uid", "==", uid).stream()
    for snapshot in snapshots:
        participant = snapshot.to_dict() or {}
        if participant.get("isAdmin") or participant.get("isSuperAdmin"):
            return {
                "uid": uid,
                "participantId": snapshot.id,
                "name": participant.get("name") or decoded.get("name") or "Admin",
            }, None

    return None, "Admin permission required"


def _normalize_participant(snapshot):
    data = snapshot.to_dict() or {}
    data["id"] = snapshot.id
    trip_ids = data.get("tripIds") or ([data.get("tripId")] if data.get("tripId") else [])
    data["tripIds"] = [trip_id for trip_id in trip_ids if trip_id]
    return data


def _load_participants(participant_ids=None, trip_id=""):
    db = get_firestore_client()
    rows_by_id = {}

    if participant_ids:
        for participant_id in participant_ids:
            snapshot = db.collection("participants").document(participant_id).get()
            if snapshot.exists:
                rows_by_id[snapshot.id] = _normalize_participant(snapshot)
    elif trip_id:
        for snapshot in db.collection("participants").where("tripIds", "array_contains", trip_id).stream():
            rows_by_id[snapshot.id] = _normalize_participant(snapshot)
        for snapshot in db.collection("participants").where("tripId", "==", trip_id).stream():
            rows_by_id[snapshot.id] = _normalize_participant(snapshot)
    else:
        return []

    if trip_id:
        return [
            participant
            for participant in rows_by_id.values()
            if trip_id in participant.get("tripIds", [])
        ]
    return list(rows_by_id.values())


def _extract_push_tokens(participant):
    tokens = participant.get("pushTokens")
    if not isinstance(tokens, list):
        tokens = [{"token": participant.get("pushToken")}] if participant.get("pushToken") else []

    result = []
    seen = set()
    for item in tokens:
        token = (item or {}).get("token")
        if not token or token in seen or (item or {}).get("permission") == "denied":
            continue
        seen.add(token)
        result.append(token)
    return result


def _stringify_data(data):
    result = {}
    for key, value in (data or {}).items():
        if value is None:
            result[str(key)] = ""
        else:
            result[str(key)] = str(value)
    return result


def _send_to_token(token, title, body, image_url="", click_url="", silent=False, data=None):
    message_data = {
        "title": title,
        "body": body,
        "image": image_url or "",
        "clickUrl": click_url or "",
        **_stringify_data(data),
    }
    notification = None if silent else messaging.Notification(
        title=title,
        body=body,
        image=image_url or None,
    )
    webpush = None
    if click_url and not silent:
        webpush = messaging.WebpushConfig(
            fcm_options=messaging.WebpushFCMOptions(link=click_url)
        )

    return messaging.send(
        messaging.Message(
            token=token,
            notification=notification,
            data=message_data,
            webpush=webpush,
        ),
        app=get_firebase_app(),
    )


def handle_send_notification(request):
    try:
        admin, auth_error = _verify_admin(request)
        if auth_error:
            return _json_error(auth_error, 401 if "authorization" in auth_error.lower() else 403)
    except Exception as exc:
        return _json_error(f"Authorization failed: {exc}", 401)

    payload = _request_json(request)
    title = str(payload.get("title") or "").strip()
    body = str(payload.get("body") or "").strip()
    image_url = str(payload.get("imageUrl") or "").strip()
    click_url = str(payload.get("clickUrl") or "").strip()
    trip_id = str(payload.get("tripId") or "").strip()
    message_type = str(payload.get("type") or "").strip()
    silent = bool(payload.get("silent")) or message_type == "itineraryUpdated"
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    participant_ids = [
        str(item).strip()
        for item in (payload.get("participantIds") or [])
        if str(item).strip()
    ]

    if not silent and not title:
        return _json_error("Notification title is required.")
    if not silent and not body:
        return _json_error("Notification body is required.")
    if not participant_ids and not trip_id:
        return _json_error("Select a trip or at least one participant.")

    participants = _load_participants(participant_ids=participant_ids, trip_id=trip_id)
    deliveries = []
    for participant in participants:
        for token in _extract_push_tokens(participant):
            deliveries.append(
                {
                    "participantId": participant.get("id"),
                    "participantName": participant.get("name") or "",
                    "token": token,
                }
            )

    successes = []
    failures = []
    for delivery in deliveries:
        try:
            message_id = _send_to_token(
                delivery["token"],
                title,
                body,
                image_url=image_url,
                click_url=click_url,
                silent=silent,
                data={
                    **data,
                    "type": message_type or data.get("type") or "",
                    "tripId": trip_id,
                },
            )
            successes.append({**delivery, "messageId": message_id})
        except Exception as exc:
            failures.append(
                {
                    "participantId": delivery["participantId"],
                    "participantName": delivery["participantName"],
                    "error": str(exc),
                }
            )

    log_ref = get_firestore_client().collection("notificationLogs").document()
    log_ref.set(
        {
            "title": title,
            "body": body,
            "imageUrl": image_url,
            "clickUrl": click_url,
            "type": message_type,
            "silent": silent,
            "data": _stringify_data(data),
            "tripId": trip_id,
            "participantIds": [item.get("id") for item in participants],
            "requestedParticipantIds": participant_ids,
            "targetCount": len(deliveries),
            "successCount": len(successes),
            "failureCount": len(failures),
            "failures": failures[:20],
            "createdByUid": admin.get("uid"),
            "createdByName": admin.get("name"),
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    )

    return {
        "status": "ok",
        "logId": log_ref.id,
        "targetCount": len(deliveries),
        "successCount": len(successes),
        "failureCount": len(failures),
        "failures": failures[:20],
    }, 200
