import re
import pandas as pd


# ── Location-type keyword maps ───────────────────────────────────────────────
METRO_KEYWORDS = [
    "metro station", "metro", "namma metro", "rapid metro",
]
COMMERCIAL_KEYWORDS = [
    "mall", "market", "plaza", "commercial", "shopping", "bazaar",
    "shop", "store", "complex", "centre", "center",
]
MAIN_ROAD_KEYWORDS = [
    "main road", "highway", "nh ", "sh ", "state highway",
    "ring road", "outer ring", "inner ring", "flyover", "overpass",
]
HOSPITAL_KEYWORDS = ["hospital", "clinic", "medical", "health centre"]
SCHOOL_KEYWORDS = ["school", "college", "university", "institute"]


def _infer_location_type(location: str) -> str:
    """Classify a free-text address into a location context category."""
    if pd.isna(location):
        return "unknown"
    loc = location.lower()
    if any(kw in loc for kw in METRO_KEYWORDS):
        return "metro_station"
    if any(kw in loc for kw in COMMERCIAL_KEYWORDS):
        return "commercial"
    if any(kw in loc for kw in HOSPITAL_KEYWORDS):
        return "hospital_school"
    if any(kw in loc for kw in SCHOOL_KEYWORDS):
        return "hospital_school"
    if any(kw in loc for kw in MAIN_ROAD_KEYWORDS):
        return "main_road"
    return "residential"


def _parse_junction(junction_name: str):
    """
    Parse 'BTP051 - Safina Plaza Junction' into:
        junction_id    = 'BTP051'
        junction_label = 'Safina Plaza Junction'
    """
    if pd.isna(junction_name) or str(junction_name).strip() == "No Junction":
        return None, "No Junction"
    m = re.match(r"^(BTP\d+)\s*-\s*(.+)$", str(junction_name).strip())
    if m:
        return m.group(1), m.group(2).strip()
    return None, str(junction_name).strip()


def load_violations(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df.dropna(subset=["latitude", "longitude"], how="all")

    # ── Datetime parsing ─────────────────────────────────────────────────────
    df["created_datetime"] = pd.to_datetime(
        df["created_datetime"], errors="coerce", utc=True
    )
    df["closed_datetime"] = pd.to_datetime(
        df["closed_datetime"], errors="coerce", utc=True
    )

    # Convert to IST (UTC+5:30) for local-hour accuracy
    df["created_datetime_ist"] = df["created_datetime"].dt.tz_convert(
        "Asia/Kolkata"
    )

    df["hour"] = df["created_datetime_ist"].dt.hour
    df["day_of_week"] = df["created_datetime_ist"].dt.dayofweek  # 0=Mon
    df["month"] = df["created_datetime_ist"].dt.month
    df["week"] = df["created_datetime_ist"].dt.isocalendar().week.astype("Int64")
    df["year_week"] = (
        df["created_datetime_ist"].dt.year.astype("Int64").astype(str).str.replace("<NA>", "")
        + "-W"
        + df["week"].astype(str).str.zfill(2).str.replace("<NA>", "")
    )
    df["year_week"] = df["year_week"].where(df["created_datetime_ist"].notna(), other=None)


    # ── Resolution time ──────────────────────────────────────────────────────
    df["resolution_hours"] = (
        (df["closed_datetime"] - df["created_datetime"]).dt.total_seconds() / 3600
    )

    # ── Location context tagging ─────────────────────────────────────────────
    df["location_type"] = df["location"].apply(_infer_location_type)

    # ── Junction parsing ─────────────────────────────────────────────────────
    parsed = df["junction_name"].apply(_parse_junction)
    df["junction_id"] = [p[0] for p in parsed]
    df["junction_label"] = [p[1] for p in parsed]

    return df
