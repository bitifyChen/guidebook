from firebase_admin import auth

from common.firebase import get_firebase_app, get_firestore_client


SUPER_ADMIN_UIDS = {"nJ4o0KAJUhdZ9eIYXSapIMfe74z2"}


def verify_admin_request(request):
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
        return {
            "uid": uid,
            "name": decoded.get("name") or decoded.get("email") or "Admin",
        }, None

    snapshots = (
        get_firestore_client()
        .collection("participants")
        .where("uid", "==", uid)
        .stream()
    )
    for snapshot in snapshots:
        participant = snapshot.to_dict() or {}
        if participant.get("isAdmin") or participant.get("isSuperAdmin"):
            return {
                "uid": uid,
                "participantId": snapshot.id,
                "name": participant.get("name")
                or decoded.get("name")
                or "Admin",
            }, None

    return None, "Admin permission required"
