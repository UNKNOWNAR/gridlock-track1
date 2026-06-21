"""
api.py — FastAPI backend for BTP Enforcement Intelligence
Serves all data endpoints consumed by the React frontend.
"""
import os
import json
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
import pandas as pd

# ── Import our analytics modules ─────────────────────────────────────────────
from modules.data_loader import load_violations
from modules.violation_decoder import decode_violations
from modules.clustering import find_hotspots
from modules.scoring import score_clusters
from modules.trend_engine import compute_weekly_trends, get_trending_zones
from modules.patrol_scheduler import generate_patrol_schedule, schedule_summary

load_dotenv()

app = FastAPI(title="BTP Enforcement Intelligence API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── One-time data load on startup ─────────────────────────────────────────────
print("Loading dataset... (this takes ~20s the first time)")
_df = load_violations("data/violations.csv")
_df = decode_violations(_df)
_df = find_hotspots(_df)
_cluster_stats = score_clusters(_df)
_trends = compute_weekly_trends(_df)
_cluster_stats = get_trending_zones(_cluster_stats, _trends["cluster_trend"])
_patrol_schedule = generate_patrol_schedule(_cluster_stats)
print(f"Ready — {len(_df):,} rows, {len(_cluster_stats)} clusters")


# ── Helper to safely convert NaN to None ─────────────────────────────────────
def _clean(val):
    if isinstance(val, float) and pd.isna(val):
        return None
    return val


def _row_to_dict(row: pd.Series) -> dict:
    return {k: _clean(v) for k, v in row.items()}


# ════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/stats")
def get_stats():
    """Global KPIs for the metrics ribbon."""
    top = _cluster_stats.iloc[0] if not _cluster_stats.empty else None
    total_delay = float(_cluster_stats["estimated_delay_minutes"].sum()) if not _cluster_stats.empty else 0
    return {
        "total_cases": int(len(_df)),
        "approved": int((_df["validation_status"] == "approved").sum()),
        "rejected": int((_df["validation_status"] == "rejected").sum()),
        "avg_approval_rate": float((_df["validation_status"] == "approved").mean()),
        "hotspots_count": int(len(_cluster_stats)),
        "enforcement_gaps": int(_cluster_stats["enforcement_gap_flag"].sum()) if not _cluster_stats.empty else 0,
        "critical_zones": int((_cluster_stats["impact_category"] == "CRITICAL").sum()) if not _cluster_stats.empty else 0,
        "total_delay_hours": round(total_delay / 60, 1),
        "unique_junctions": int(_df["junction_label"].nunique()),
        "highest_risk_zone": {
            "lat": float(top["lat"]),
            "lon": float(top["lon"]),
            "score": float(top["congestion_score"]),
            "police_station": str(top["top_police_station"]),
            "impact": str(top["impact_category"]),
            "delay_min": float(top["estimated_delay_minutes"]),
        } if top is not None else None,
    }


@app.get("/api/hotspots")
def get_hotspots():
    """All cluster stats for map rendering and tables."""
    if _cluster_stats.empty:
        return []
    records = _cluster_stats.drop(columns=["vehicle_type_mix"], errors="ignore")
    out = []
    for _, row in records.iterrows():
        d = _row_to_dict(row)
        out.append(d)
    return out


@app.get("/api/violations")
def get_violations(limit: int = 600):
    """Sample raw violation points for map rendering."""
    approved = _df[_df["validation_status"] == "approved"].dropna(subset=["latitude", "longitude"])
    sample = approved.sample(min(limit, len(approved)), random_state=42)
    return [
        {"lat": float(r["latitude"]), "lon": float(r["longitude"])}
        for _, r in sample.iterrows()
    ]


@app.get("/api/shifts")
def get_shifts():
    """Shift analysis — top hotspots per shift window."""
    shift_windows = {
        "Morning": (6, 11),
        "Afternoon": (12, 16),
        "Evening": (17, 23),
        "Night": (0, 5),
    }
    result = {}
    for shift_name, (h_start, h_end) in shift_windows.items():
        shift_df = _df[_df["hour"].between(h_start, h_end)]
        shift_clustered = shift_df[shift_df["cluster"] != -1]
        top_violation = (
            shift_df["primary_violation"].mode().iloc[0]
            if not shift_df.empty and not shift_df["primary_violation"].mode().empty
            else "Unknown"
        )
        shift_counts = (
            shift_clustered.groupby("cluster").size()
            .reset_index(name="count")
            .sort_values("count", ascending=False)
            .head(5)
        ) if not shift_clustered.empty else pd.DataFrame(columns=["cluster", "count"])

        top_hotspots = []
        for _, sc in shift_counts.iterrows():
            cid = sc["cluster"]
            match = _cluster_stats[_cluster_stats["cluster_id"] == cid]
            if match.empty:
                continue
            info = match.iloc[0]
            top_hotspots.append({
                "cluster_id": int(cid),
                "count": int(sc["count"]),
                "police_station": str(info["top_police_station"]),
                "impact": str(info.get("impact_category", "MODERATE")),
                "is_gap": bool(info["enforcement_gap_flag"]),
            })

        result[shift_name] = {
            "hours": f"{h_start:02d}:00–{h_end:02d}:59",
            "total": int(len(shift_df)),
            "top_violation": top_violation,
            "has_gap_zone": any(h["is_gap"] for h in top_hotspots),
            "top_hotspots": top_hotspots,
        }
    return result


@app.get("/api/stations")
def get_stations():
    """List of all police stations."""
    return sorted(_df["police_station"].dropna().unique().tolist())


@app.get("/api/station/{station_name}")
def get_station(station_name: str):
    """Detailed breakdown for a single police station."""
    sdf = _df[_df["police_station"] == station_name]
    if sdf.empty:
        raise HTTPException(status_code=404, detail="Station not found")

    # Monthly trend
    monthly_trend = sdf.groupby("month").size().to_dict()

    # Vehicle mix (top 6)
    vehicle_mix = sdf["vehicle_type"].value_counts().head(6).to_dict()

    # Top violations
    top_violations = [
        {"violation": k, "count": int(v)}
        for k, v in sdf["primary_violation"].value_counts().head(6).items()
    ]

    # Top junctions (not "No Junction")
    junc = sdf[sdf["junction_label"] != "No Junction"]
    top_junctions = [
        {"junction": k, "count": int(v)}
        for k, v in junc["junction_label"].value_counts().head(8).items()
    ]

    # Cluster stats for this station
    station_clusters = _cluster_stats[_cluster_stats["top_police_station"] == station_name]
    gaps_count = int(station_clusters["enforcement_gap_flag"].sum()) if not station_clusters.empty else 0

    total = len(sdf)
    approved = int((sdf["validation_status"] == "approved").sum())
    avg_res = float(sdf["resolution_hours"].dropna().mean()) if sdf["resolution_hours"].notna().any() else None

    # Severity breakdown
    severity_breakdown = sdf["parking_category"].value_counts().to_dict() if "parking_category" in sdf.columns else {}

    return {
        "total_cases": total,
        "approved": approved,
        "approval_rate": round(approved / total, 3) if total > 0 else 0,
        "avg_resolution_hours": round(avg_res, 1) if avg_res else None,
        "hotspots_count": len(station_clusters),
        "gaps_count": gaps_count,
        "monthly_trend": {str(k): int(v) for k, v in monthly_trend.items()},
        "vehicle_mix": {k: int(v) for k, v in vehicle_mix.items()},
        "top_violations": top_violations,
        "top_junctions": top_junctions,
        "severity_breakdown": {k: int(v) for k, v in severity_breakdown.items()},
    }


@app.get("/api/parking")
def get_parking():
    """Parking Intelligence data — severity, location type, sub-type breakdown."""
    loc_counts = _df.groupby("location_type").size().to_dict()

    # All unique parking sub-types
    import json as _json
    sub_type_counts: dict = {}
    for val in _df["violation_type"].dropna():
        try:
            types = _json.loads(val)
            for t in types:
                sub_type_counts[t] = sub_type_counts.get(t, 0) + 1
        except Exception:
            pass

    severity_counts = _df["parking_category"].value_counts().to_dict()

    top_hotspots = []
    for _, row in _cluster_stats.head(25).iterrows():
        top_hotspots.append({
            "cluster_id": int(row["cluster_id"]),
            "junction_label": str(row["junction_label"]),
            "top_police_station": str(row["top_police_station"]),
            "location_type": str(row["location_type"]),
            "violation_count": int(row["violation_count"]),
            "parking_category": str(row["parking_category"]),
            "impact_category": str(row["impact_category"]),
            "estimated_delay_minutes": float(row["estimated_delay_minutes"]),
            "carriageway_blockage_pct": float(row["carriageway_blockage_pct"]),
            "trend": str(row.get("trend", "→ Stable")),
        })

    return {
        "location_counts": {k: int(v) for k, v in loc_counts.items()},
        "severity_counts": {k: int(v) for k, v in severity_counts.items()},
        "sub_type_counts": dict(sorted(sub_type_counts.items(), key=lambda x: -x[1])[:20]),
        "top_hotspots": top_hotspots,
    }


@app.get("/api/congestion")
def get_congestion():
    """Congestion Impact — delay KPIs, hourly heatmap, junction risks."""
    total_delay = float(_cluster_stats["estimated_delay_minutes"].sum()) if not _cluster_stats.empty else 0
    critical_zones = int((_cluster_stats["impact_category"] == "CRITICAL").sum()) if not _cluster_stats.empty else 0
    unique_junctions = int(_df["junction_label"].nunique())

    critical_rows = _df[_df["parking_category"] == "CRITICAL"] if "parking_category" in _df.columns else _df
    peak_hour = int(critical_rows["hour"].mode().iloc[0]) if not critical_rows.empty else 0

    # Hourly heatmap: hour × parking_category counts
    if "parking_category" in _df.columns:
        hourly_pivot = (
            _df[_df["parking_category"] != "OTHER"]
            .groupby(["hour", "parking_category"])
            .size()
            .unstack(fill_value=0)
        )
        heatmap_data = []
        for h in range(24):
            row = {"hour": h}
            for cat in ["CRITICAL", "HIGH", "MODERATE"]:
                row[cat] = int(hourly_pivot.get(cat, pd.Series(dtype=int)).get(h, 0))
            heatmap_data.append(row)
    else:
        heatmap_data = [{"hour": h, "CRITICAL": 0, "HIGH": 0, "MODERATE": 0} for h in range(24)]

    # Junction risk table
    junc_risk = (
        _df[_df["junction_label"] != "No Junction"]
        .groupby(["junction_id", "junction_label", "police_station"])
        .agg(
            violation_count=("id", "count"),
            critical_count=("parking_category", lambda x: int((x == "CRITICAL").sum())),
        )
        .reset_index()
        .sort_values("critical_count", ascending=False)
        .head(20)
    )
    junction_risks = [
        {
            "junction_id": str(r["junction_id"]) if r["junction_id"] else "",
            "junction_label": str(r["junction_label"]),
            "police_station": str(r["police_station"]),
            "violation_count": int(r["violation_count"]),
            "critical_count": int(r["critical_count"]),
        }
        for _, r in junc_risk.iterrows()
    ]

    # Weekly trend
    overall_trend = _trends.get("overall", pd.DataFrame())
    weekly_trend = (
        overall_trend[["year_week", "count", "trend"]].dropna()
        .rename(columns={"year_week": "week", "count": "violations"})
        .to_dict(orient="records")
    ) if not overall_trend.empty else []

    # Vehicle blockage reference
    vehicle_blockage = [
        {"vehicle": "HGV/TANKER", "blockage_pct": 45},
        {"vehicle": "Private Bus", "blockage_pct": 40},
        {"vehicle": "LGV", "blockage_pct": 28},
        {"vehicle": "Van/Tempo", "blockage_pct": 22},
        {"vehicle": "Maxi-Cab", "blockage_pct": 18},
        {"vehicle": "Car", "blockage_pct": 15},
        {"vehicle": "Auto", "blockage_pct": 10},
        {"vehicle": "Scooter/Bike", "blockage_pct": 5},
    ]

    return {
        "total_delay_hours": round(total_delay / 60, 1),
        "critical_zones": critical_zones,
        "unique_junctions": unique_junctions,
        "peak_impact_hour": peak_hour,
        "heatmap_data": heatmap_data,
        "junction_risks": junction_risks,
        "weekly_trend": weekly_trend,
        "vehicle_blockage": vehicle_blockage,
    }


@app.get("/api/patrol")
def get_patrol():
    """Patrol schedule data."""
    if _patrol_schedule.empty:
        return {"summary": {}, "schedule": []}

    summary = schedule_summary(_patrol_schedule)
    schedule = _patrol_schedule.to_dict(orient="records")
    # Clean NaN
    schedule = [{k: _clean(v) for k, v in row.items()} for row in schedule]
    return {"summary": summary, "schedule": schedule}


@app.get("/api/mapmyindia/html", response_class=HTMLResponse)
def get_mapmyindia_html():
    """Serve the MapmyIndia map HTML with injected data."""
    api_key = os.getenv("MAPMYINDIA_API_KEY", "")
    if not api_key or api_key == "your_key_here":
        return HTMLResponse("<h3 style='color:#c0392b;font-family:sans-serif;padding:2rem'>MapmyIndia API key not configured. Add MAPMYINDIA_API_KEY to .env</h3>")

    top30 = _cluster_stats.head(30)[[
        "cluster_id", "lat", "lon", "congestion_score",
        "violation_count", "top_violation", "top_police_station",
        "impact_category", "parking_category", "estimated_delay_minutes",
        "carriageway_blockage_pct", "location_type", "junction_label", "trend"
    ]].to_dict(orient="records")
    # Clean NaN
    top30 = [{k: _clean(v) for k, v in row.items()} for row in top30]

    template_path = Path("components/mapmyindia_map.html")
    html = template_path.read_text(encoding="utf-8")
    html = html.replace("{API_KEY}", api_key)
    html = html.replace("__HOTSPOT_DATA__", json.dumps(top30))
    return HTMLResponse(html)


# Serve built React frontend static assets from root
from fastapi.staticfiles import StaticFiles
if os.path.exists("frontend/dist"):
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")

