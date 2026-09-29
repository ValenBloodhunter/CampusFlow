import math
import os
import re

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv()

app = Flask(
    __name__,
    static_folder="public",
    static_url_path="",
)

ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

# Destination coordinates start as 0.0 placeholders.
# Phase P3-6 replaces them with real campus points copied from Google Maps.
LOCATIONS = {
    "library": {
        "name": "Central Library",
        "lat": 0.0,
        "lng": 0.0,
        "fallbackWalkMinutes": 5,
    },
    "cafeteria": {
        "name": "Cafeteria",
        "lat": 0.0,
        "lng": 0.0,
        "fallbackWalkMinutes": 4,
    },
    "admin": {
        "name": "Admin Office",
        "lat": 0.0,
        "lng": 0.0,
        "fallbackWalkMinutes": 7,
    },
}


def parse_number(value, field_name, *, minimum=None):
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a number")

    if not math.isfinite(number):
        raise ValueError(f"{field_name} must be finite")

    if minimum is not None and number < minimum:
        raise ValueError(f"{field_name} must be at least {minimum}")

    return number


def parse_google_duration_seconds(value):
    """Parse Google protobuf JSON durations such as '245s' or '245.4s'."""
    if not isinstance(value, str):
        raise ValueError("Google route duration is missing")

    match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)s", value.strip())
    if not match:
        raise ValueError(f"Unexpected Google duration: {value}")

    return float(match.group(1))


def valid_destination_coordinates(location):
    lat = float(location.get("lat", 0.0))
    lng = float(location.get("lng", 0.0))
    return not (lat == 0.0 and lng == 0.0)


def get_google_walking_route(origin_lat, origin_lng, location):
    """Return (walk_minutes, distance_meters), or raise so caller can fallback."""
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()

    if not api_key:
        raise RuntimeError("GOOGLE_MAPS_API_KEY is not configured")

    if not valid_destination_coordinates(location):
        raise RuntimeError("Destination coordinates are still placeholders")

    payload = {
        "origin": {
            "location": {
                "latLng": {
                    "latitude": origin_lat,
                    "longitude": origin_lng,
                }
            }
        },
        "destination": {
            "location": {
                "latLng": {
                    "latitude": float(location["lat"]),
                    "longitude": float(location["lng"]),
                }
            }
        },
        "travelMode": "WALK",
        "computeAlternativeRoutes": False,
        "languageCode": "en-US",
        "units": "METRIC",
    }

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    }

    response = requests.post(
        ROUTES_URL,
        headers=headers,
        json=payload,
        timeout=7,
    )
    response.raise_for_status()

    data = response.json()
    routes = data.get("routes") or []
    if not routes:
        raise RuntimeError("Google Routes returned no route")

    route = routes[0]
    duration_seconds = parse_google_duration_seconds(route.get("duration"))
    distance_meters = route.get("distanceMeters")

    if distance_meters is not None:
        distance_meters = int(distance_meters)

    walk_minutes = duration_seconds / 60.0
    return walk_minutes, distance_meters


def build_recommendation(location_id, count, avg_service_seconds, walk_minutes, distance_meters, source):
    queue_wait_minutes = (count * avg_service_seconds) / 60.0
    raw_leave_in = max(0.0, queue_wait_minutes - walk_minutes)

    if raw_leave_in <= 1:
        action = "LEAVE_NOW"
        leave_in_minutes = 0.0
        headline = "LEAVE NOW"
    else:
        action = "WAIT"
        leave_in_minutes = raw_leave_in
        headline = f"WAIT {round(raw_leave_in)} MIN, THEN LEAVE"

    return {
        "locationId": location_id,
        "walkMinutes": round(walk_minutes, 1),
        "distanceMeters": distance_meters,
        "queueWaitMinutes": round(queue_wait_minutes, 1),
        "leaveInMinutes": round(leave_in_minutes, 1),
        "action": action,
        "headline": headline,
        "source": source,
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/admin")
def admin():
    return render_template("admin.html")


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/recommend", methods=["POST"])
def recommend():
    body = request.get_json(silent=True) or {}

    location_id = body.get("locationId")
    if location_id not in LOCATIONS:
        return jsonify({"error": "Invalid locationId"}), 400

    try:
        count = parse_number(body.get("count"), "count", minimum=0)
        avg_service_seconds = parse_number(
            body.get("avgServiceSeconds"),
            "avgServiceSeconds",
            minimum=0,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    location = LOCATIONS[location_id]
    fallback_walk = float(location["fallbackWalkMinutes"])

    latitude = body.get("latitude")
    longitude = body.get("longitude")

    walk_minutes = fallback_walk
    distance_meters = None
    source = "fallback"

    # Google routing is optional. Missing/invalid GPS or API failure simply keeps fallback values.
    if latitude is not None and longitude is not None:
        try:
            origin_lat = parse_number(latitude, "latitude")
            origin_lng = parse_number(longitude, "longitude")

            if not (-90 <= origin_lat <= 90):
                raise ValueError("latitude must be between -90 and 90")
            if not (-180 <= origin_lng <= 180):
                raise ValueError("longitude must be between -180 and 180")

            walk_minutes, distance_meters = get_google_walking_route(
                origin_lat,
                origin_lng,
                location,
            )
            source = "google_routes"
        except Exception as exc:
            # Short server-side diagnostic; never expose the API key.
            print(f"Routes fallback for {location_id}: {exc}")

    result = build_recommendation(
        location_id=location_id,
        count=count,
        avg_service_seconds=avg_service_seconds,
        walk_minutes=walk_minutes,
        distance_meters=distance_meters,
        source=source,
    )

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)