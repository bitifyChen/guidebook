import os

from flask import Flask, request

from views.health import health_response
from views.notifications import handle_send_notification
from views.tracking import handle_traccar_location


DEFAULT_CORS_ALLOWED_ORIGINS = (
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://guidebook.chenchenworkshop.com",
    "https://guidebook-jeju.web.app",
    "https://guidebook-jeju.firebaseapp.com",
)


def create_app():
    app = Flask(__name__)

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        configured_origins = {
            item.strip()
            for item in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
            if item.strip()
        }
        allowed_origins = set(DEFAULT_CORS_ALLOWED_ORIGINS).union(configured_origins)

        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
            response.headers["Access-Control-Max-Age"] = "86400"

        return response

    @app.route("/health", methods=["GET"])
    @app.route("/website/health", methods=["GET"])
    def health():
        return health_response()

    @app.route("/tracking/traccar", methods=["GET", "POST", "OPTIONS"])
    @app.route("/api/tracking/traccar", methods=["GET", "POST", "OPTIONS"])
    def traccar_location():
        if request.method == "OPTIONS":
            return ("", 204)
        return handle_traccar_location(request)

    @app.route("/notifications/send", methods=["POST", "OPTIONS"])
    @app.route("/api/notifications/send", methods=["POST", "OPTIONS"])
    def send_notification():
        if request.method == "OPTIONS":
            return ("", 204)
        return handle_send_notification(request)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
