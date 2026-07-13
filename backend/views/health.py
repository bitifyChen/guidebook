import os
import time


def health_response():
    return {
        "status": "ok",
        "service": "guidebook-backend",
        "environment": os.getenv("RENDER_SERVICE_NAME", "local"),
        "time": int(time.time()),
    }, 200
