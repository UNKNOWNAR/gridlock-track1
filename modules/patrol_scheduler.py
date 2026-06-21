"""
patrol_scheduler.py
Generate daily patrol deployment schedules from cluster statistics.
"""
import math
import pandas as pd


SHIFT_MAP = {
    # hour -> shift name
    **{h: "Night (00–05)" for h in range(0, 6)},
    **{h: "Morning (06–11)" for h in range(6, 12)},
    **{h: "Afternoon (12–16)" for h in range(12, 17)},
    **{h: "Evening (17–23)" for h in range(17, 24)},
}

DAY_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}

IMPACT_PRIORITY = {"CRITICAL": 1, "HIGH": 2, "MODERATE": 3, "LOW": 4}


def _personnel_needed(congestion_score: float, impact_category: str) -> int:
    """
    Estimate number of officers needed for a zone.
    Base: ceil(score / 50), adjusted by impact tier.
    """
    base = math.ceil(congestion_score / 50)
    multiplier = {"CRITICAL": 1.5, "HIGH": 1.2, "MODERATE": 1.0, "LOW": 0.8}.get(impact_category, 1.0)
    return max(1, min(int(math.ceil(base * multiplier)), 6))


def generate_patrol_schedule(cluster_stats: pd.DataFrame) -> pd.DataFrame:
    """
    Build a deployment schedule table from cluster_stats.

    Returns DataFrame with columns:
        priority, cluster_id, area_name, police_station,
        location_type, peak_shift, peak_day, impact_category,
        estimated_delay_min, carriageway_blockage_pct,
        personnel_needed, enforcement_gap
    """
    if cluster_stats.empty:
        return pd.DataFrame()

    rows = []
    for _, row in cluster_stats.iterrows():
        peak_hour = int(row.get("peak_hour", 0))
        peak_shift = SHIFT_MAP.get(peak_hour, "Morning (06–11)")
        peak_day_num = int(row.get("peak_day", 0))
        peak_day = DAY_MAP.get(peak_day_num, "Mon")

        impact = str(row.get("impact_category", "MODERATE"))
        congestion = float(row.get("congestion_score", 0))
        personnel = _personnel_needed(congestion, impact)

        area_name = str(row.get("junction_label", "Unknown"))
        if area_name == "No Junction":
            area_name = f"Zone {int(row['cluster_id'])} area"

        rows.append({
            "priority": IMPACT_PRIORITY.get(impact, 4),
            "cluster_id": int(row["cluster_id"]),
            "area_name": area_name,
            "junction_id": row.get("junction_id", ""),
            "police_station": str(row.get("top_police_station", "Unknown")),
            "location_type": str(row.get("location_type", "unknown")).replace("_", " ").title(),
            "peak_shift": peak_shift,
            "peak_day": peak_day,
            "impact_category": impact,
            "parking_category": str(row.get("parking_category", "OTHER")),
            "estimated_delay_min": float(row.get("estimated_delay_minutes", 0)),
            "carriageway_blockage_pct": float(row.get("carriageway_blockage_pct", 0)),
            "personnel_needed": personnel,
            "enforcement_gap": bool(row.get("enforcement_gap_flag", False)),
            "violation_count": int(row.get("violation_count", 0)),
        })

    schedule = pd.DataFrame(rows).sort_values(
        ["priority", "estimated_delay_min"], ascending=[True, False]
    ).reset_index(drop=True)

    return schedule


def schedule_summary(schedule: pd.DataFrame) -> dict:
    """Return high-level KPIs about the patrol schedule."""
    if schedule.empty:
        return {}
    return {
        "total_zones": len(schedule),
        "critical_zones": int((schedule["impact_category"] == "CRITICAL").sum()),
        "high_zones": int((schedule["impact_category"] == "HIGH").sum()),
        "total_personnel": int(schedule["personnel_needed"].sum()),
        "enforcement_gaps": int(schedule["enforcement_gap"].sum()),
        "top_shift": schedule["peak_shift"].mode().iloc[0],
        "top_station": schedule["police_station"].mode().iloc[0],
    }
