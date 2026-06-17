import os
import requests
from dotenv import load_dotenv

load_dotenv()


def _get_key():
    return os.getenv("MAPMYINDIA_API_KEY", "")


def get_nearby_pois(lat, lon, api_key=None):
    try:
        key = api_key or _get_key()
        resp = requests.get(
            "https://atlas.mapmyindia.com/api/places/nearby/json",
            params={
                "keywords": "market,metro,stadium,school,hospital",
                "refLocation": f"{lat},{lon}",
                "radius": 500,
            },
            headers={"Authorization": f"Bearer {key}"},
            timeout=10,
        )
        data = resp.json()
        return [p.get("placeName", "") for p in data.get("suggestedLocations", [])]
    except Exception:
        return []


def geocode_place(place_name, api_key=None):
    try:
        key = api_key or _get_key()
        resp = requests.get(
            "https://atlas.mapmyindia.com/api/places/geocode",
            params={"address": place_name},
            headers={"Authorization": f"Bearer {key}"},
            timeout=10,
        )
        data = resp.json()
        coords = data.get("copResults", {})
        return (float(coords["latitude"]), float(coords["longitude"]))
    except Exception:
        return None


def get_patrol_route(waypoints, api_key=None):
    try:
        key = api_key or _get_key()
        if not waypoints or len(waypoints) > 10:
            return []
        coords = "|".join([f"{lon},{lat}" for lat, lon in waypoints])
        resp = requests.get(
            f"https://apis.mappls.com/advancedmaps/v1/{key}/route_adv/driving/{coords}",
            timeout=10,
        )
        data = resp.json()
        route = data.get("routes", [{}])[0]
        geometry = route.get("geometry", "")
        if not geometry:
            return []
        return geometry
    except Exception:
        return []
