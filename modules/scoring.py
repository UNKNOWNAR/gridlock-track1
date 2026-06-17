import pandas as pd

VEHICLE_WEIGHTS = {
    "CAR": 1.5,
    "SCOOTER": 0.8,
    "TANKER": 3.0,
    "VAN": 2.0,
    "PASSENGER": 2.5,
    "GOODS AUTO": 2.0,
}


def score_clusters(df: pd.DataFrame) -> pd.DataFrame:
    clustered = df[df["cluster"] != -1].copy()
    if clustered.empty:
        return pd.DataFrame()

    clustered["vehicle_weight"] = clustered["vehicle_type"].map(
        lambda v: VEHICLE_WEIGHTS.get(str(v).upper(), 1.0)
    )

    records = []
    for cid, grp in clustered.groupby("cluster"):
        violation_count = len(grp)
        lat = grp["latitude"].mean()
        lon = grp["longitude"].mean()
        top_violation = grp["primary_violation"].mode().iloc[0] if not grp["primary_violation"].mode().empty else "Unknown"
        vehicle_type_mix = grp["vehicle_type"].value_counts().to_dict()
        avg_vehicle_weight = grp["vehicle_weight"].mean()
        congestion_score = violation_count * avg_vehicle_weight

        total_at_location = len(df[
            (df["latitude"].between(lat - 0.001, lat + 0.001))
            & (df["longitude"].between(lon - 0.001, lon + 0.001))
        ])
        approved_at_location = len(df[
            (df["latitude"].between(lat - 0.001, lat + 0.001))
            & (df["longitude"].between(lon - 0.001, lon + 0.001))
            & (df["validation_status"] == "approved")
        ])
        approval_rate = approved_at_location / total_at_location if total_at_location > 0 else 0
        enforcement_gap_flag = approval_rate < 0.6

        peak_hour = grp["hour"].mode().iloc[0] if not grp["hour"].mode().empty else 0
        top_police_station = grp["police_station"].mode().iloc[0] if not grp["police_station"].mode().empty else "Unknown"

        records.append({
            "cluster_id": int(cid),
            "violation_count": violation_count,
            "lat": lat,
            "lon": lon,
            "top_violation": top_violation,
            "vehicle_type_mix": vehicle_type_mix,
            "avg_vehicle_weight": round(avg_vehicle_weight, 2),
            "congestion_score": round(congestion_score, 2),
            "approval_rate": round(approval_rate, 3),
            "enforcement_gap_flag": enforcement_gap_flag,
            "peak_hour": int(peak_hour),
            "top_police_station": top_police_station,
        })

    cluster_stats = pd.DataFrame(records).sort_values(
        "congestion_score", ascending=False
    ).reset_index(drop=True)
    return cluster_stats
