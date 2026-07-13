import os

import firebase_admin
from firebase_admin import credentials, db, firestore


def _load_credential():
    service_account_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "").strip()
    if service_account_path:
        return credentials.Certificate(service_account_path)

    return credentials.ApplicationDefault()


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
