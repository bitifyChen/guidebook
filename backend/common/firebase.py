import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, db, firestore

DEFAULT_CREDENTIAL_PATHS = (
    "/etc/secrets/firebase.json",
    "firebase.json",
)


def _load_credential():
    service_account_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "").strip()
    candidate_paths = [service_account_path] if service_account_path else []
    candidate_paths.extend(DEFAULT_CREDENTIAL_PATHS)

    for candidate_path in candidate_paths:
        if candidate_path and Path(candidate_path).is_file():
            return credentials.Certificate(candidate_path)

    if service_account_path:
        raise RuntimeError(
            "FIREBASE_CREDENTIALS_PATH is set but the file was not found: "
            f"{service_account_path}"
        )

    raise RuntimeError(
        "Firebase service account JSON was not found. Set "
        "FIREBASE_CREDENTIALS_PATH=/etc/secrets/firebase.json or add a Render "
        "Secret File named firebase.json."
    )


def get_firebase_app():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    database_url = os.getenv("FIREBASE_RTDB_URL", "").strip()
    options = {}
    if database_url:
        options["databaseURL"] = database_url

    return firebase_admin.initialize_app(_load_credential(), options)


def get_firestore_client():
    get_firebase_app()
    return firestore.client()


def get_rtdb_reference(path):
    get_firebase_app()
    return db.reference(path)
