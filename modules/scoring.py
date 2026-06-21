import pandas as pd

# ── Vehicle weight: how much congestion does each vehicle type cause ──────────
VEHICLE_WEIGHTS = {
    "CAR": 1.5,
    "SCOOTER": 0.8,
    "MOTOR CYCLE": 0.8,
    "MOPED": 0.6,
    "MOTORCYCLE": 0.8,
    "PASSENGER AUTO": 1.2,
    "GOODS AUTO": 1.5,
    "MAXI-CAB": 2.0,
    "VAN": 2.0,
    "JEEP": 1.5,
    "LGV": 2.5,
    "PRIVATE BUS": 3.0,
    "BUS (BMTC/KSRTC)": 3.0,
    "TOURIST BUS": 3.0,
    "SCHOOL VEHICLE": 2.0,
    "FACTORY BUS": 3.0,
    "TEMPO": 2.0,
    "HGV": 4.0,
    "TANKER": 4.0,
    "LORRY/GOODS VEHICLE": 3.5,
    "MINI LORRY": 3.0,
    "TRACTOR": 2.5,
}

# ── Carriageway blockage % per vehicle class ─────────────────────────────────
CARRIAGEWAY_BLOCK = {
    "CAR": 0.15,
    "SCOOTER": 0.05,
    "MOTOR CYCLE": 0.05,
    "MOPED": 0.05,
    "MOTORCYCLE": 0.05,
    "PASSENGER AUTO": 0.10,
    "GOODS AUTO": 0.12,
    "MAXI-CAB": 0.18,
    "VAN": 0.20,
    "JEEP": 0.15,
    "LGV": 0.28,
    "PRIVATE BUS": 0.35,
    "BUS (BMTC/KSRTC)": 0.40,
    "TOURIST BUS": 0.40,
    "SCHOOL VEHICLE": 0.30,
    "FACTORY BUS": 0.40,
    "TEMPO": 0.22,
    "HGV": 0.45,
    "TANKER": 0.45,
    "LORRY/GOODS VEHICLE": 0.40,
    "MINI LORRY": 0.35,
    "TRACTOR": 0.30,
}

# ── Severity multipliers for delay estimation ────────────────────────────────
SEVERITY_DELAY_FACTOR = {"CRITICAL": 3.0, "HIGH": 2.0, "MODERATE": 1.0, "OTHER": 0.5}


def _impact_category(delay_minutes: float) -> str:
    """Classify a zone's estimated delay into an operational impact tier."""
    if delay_minutes >= 500:
        return "CRITICAL"
    elif delay_minutes >= 200:
        return "HIGH"
    elif delay_minutes >= 50:
        return "MODERATE"
    return "LOW"


def score_clusters(df: pd.DataFrame) -> pd.DataFrame:
    clustered = df[df["cluster"] != -1].copy()
    if clustered.empty:
        return pd.DataFrame()

    clustered["vehicle_weight"] = clustered["vehicle_type"].map(
        lambda v: VEHICLE_WEIGHTS.get(str(v).strip().upper(), 1.0)
    )
    clustered["block_pct"] = clustered["vehicle_type"].map(
        lambda v: CARRIAGEWAY_BLOCK.get(str(v).strip().upper(), 0.10)
    )

    records = []
    for cid, grp in clustered.groupby("cluster"):
        violation_count = len(grp)
        lat = grp["latitude"].mean()
        lon = grp["longitude"].mean()

        # ── Primary violation (legacy) ────────────────────────────────────
        top_violation = (
            grp["primary_violation"].mode().iloc[0]
            if not grp["primary_violation"].mode().empty
            else "Unknown"
        )

        # ── Parking-specific fields ───────────────────────────────────────
        top_parking_category = (
            grp["parking_category"].mode().iloc[0]
            if "parking_category" in grp.columns and not grp["parking_category"].mode().empty
            else "OTHER"
        )
        avg_severity = (
            grp["congestion_severity"].mean()
            if "congestion_severity" in grp.columns
            else 1.0
        )
        parking_violation_pct = (
            grp["is_parking_violation"].mean()
            if "is_parking_violation" in grp.columns
            else 1.0
        )

        # ── Vehicle metrics ───────────────────────────────────────────────
        avg_vehicle_weight = grp["vehicle_weight"].mean()
        avg_block_pct = grp["block_pct"].mean()
        vehicle_type_mix = grp["vehicle_type"].value_counts().to_dict()
        top_vehicle = grp["vehicle_type"].mode().iloc[0] if not grp["vehicle_type"].mode().empty else "Unknown"

        # ── Scoring ───────────────────────────────────────────────────────
        congestion_score = round(violation_count * avg_vehicle_weight, 2)

        severity_factor = SEVERITY_DELAY_FACTOR.get(top_parking_category, 1.0)
        estimated_delay_minutes = round(
            violation_count * avg_vehicle_weight * severity_factor * 2.5, 1
        )
        carriageway_blockage_pct = round(
            min(avg_block_pct * violation_count / 10.0, 1.0) * 100, 1
        )
        impact_category = _impact_category(estimated_delay_minutes)

        # ── Enforcement gap ───────────────────────────────────────────────
        total_at_location = len(df[
            df["latitude"].between(lat - 0.001, lat + 0.001)
            & df["longitude"].between(lon - 0.001, lon + 0.001)
        ])
        approved_at_location = len(df[
            df["latitude"].between(lat - 0.001, lat + 0.001)
            & df["longitude"].between(lon - 0.001, lon + 0.001)
            & (df["validation_status"] == "approved")
        ])
        approval_rate = (
            approved_at_location / total_at_location if total_at_location > 0 else 0
        )
        enforcement_gap_flag = approval_rate < 0.6

        # ── Temporal peaks ────────────────────────────────────────────────
        peak_hour = (
            int(grp["hour"].mode().iloc[0])
            if not grp["hour"].mode().empty
            else 0
        )
        peak_day = (
            int(grp["day_of_week"].mode().iloc[0])
            if "day_of_week" in grp.columns and not grp["day_of_week"].mode().empty
            else 0
        )

        # ── Location context ──────────────────────────────────────────────
        top_location_type = (
            grp["location_type"].mode().iloc[0]
            if "location_type" in grp.columns and not grp["location_type"].mode().empty
            else "unknown"
        )
        top_junction_label = (
            grp["junction_label"].mode().iloc[0]
            if "junction_label" in grp.columns and not grp["junction_label"].mode().empty
            else "Unknown"
        )
        top_junction_id = (
            grp["junction_id"].dropna().mode().iloc[0]
            if "junction_id" in grp.columns and not grp["junction_id"].dropna().mode().empty
            else None
        )

        # ── Police station ────────────────────────────────────────────────
        top_police_station = (
            grp["police_station"].mode().iloc[0]
            if not grp["police_station"].mode().empty
            else "Unknown"
        )

        records.append({
            "cluster_id": int(cid),
            "violation_count": violation_count,
            "lat": lat,
            "lon": lon,
            # Legacy
            "top_violation": top_violation,
            "vehicle_type_mix": vehicle_type_mix,
            "avg_vehicle_weight": round(avg_vehicle_weight, 2),
            "congestion_score": congestion_score,
            "approval_rate": round(approval_rate, 3),
            "enforcement_gap_flag": enforcement_gap_flag,
            "peak_hour": peak_hour,
            "peak_day": peak_day,
            "top_police_station": top_police_station,
            # New: parking impact
            "parking_category": top_parking_category,
            "parking_violation_pct": round(parking_violation_pct, 3),
            "avg_severity_score": round(avg_severity, 2),
            "estimated_delay_minutes": estimated_delay_minutes,
            "carriageway_blockage_pct": carriageway_blockage_pct,
            "impact_category": impact_category,
            "top_vehicle": top_vehicle,
            # New: location context
            "location_type": top_location_type,
            "junction_label": top_junction_label,
            "junction_id": top_junction_id,
        })

    cluster_stats = pd.DataFrame(records).sort_values(
        "estimated_delay_minutes", ascending=False
    ).reset_index(drop=True)
    return cluster_stats
