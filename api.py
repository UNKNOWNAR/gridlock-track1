import os
import json
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load env variables
load_dotenv()

from modules.data_loader import load_violations
from modules.violation_decoder import decode_violations
from modules.clustering import find_hotspots
from modules.scoring import score_clusters

app = FastAPI(title="BTP Enforcement Intelligence API")

# Enable CORS for React frontend (port 5173 or * for safety in development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load data on startup
DATA_PATH = "data/violations.csv"

# Global data containers
df_violations = pd.DataFrame()
df_clusters = pd.DataFrame()

def load_and_process_data():
    global df_violations, df_clusters
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Data file {DATA_PATH} not found. Please run the data generator first.")
    
    # Load and process using original modules
    df = load_violations(DATA_PATH)
    df = decode_violations(df)
    df = find_hotspots(df)
    clusters = score_clusters(df)
    
    df_violations = df
    df_clusters = clusters
    print(f"Data processed successfully. Violations: {len(df_violations)}, Hotspots: {len(df_clusters)}")

try:
    load_and_process_data()
except Exception as e:
    print(f"Error processing data on startup: {e}")

@app.get("/api/health")
def health():
    return {"status": "ok", "records": len(df_violations), "hotspots": len(df_clusters)}

@app.get("/api/stats")
def get_stats():
    if df_violations.empty:
        return {"total_cases": 0, "hotspots": 0, "highest_risk_zone": None, "enforcement_gaps": 0}
    
    total_cases = len(df_violations)
    hotspots_count = len(df_clusters)
    gap_count = int(df_clusters["enforcement_gap_flag"].sum()) if not df_clusters.empty else 0
    
    top_zone = None
    if not df_clusters.empty:
        top_row = df_clusters.iloc[0]
        top_zone = {
            "cluster_id": int(top_row["cluster_id"]),
            "lat": float(top_row["lat"]),
            "lon": float(top_row["lon"]),
            "score": float(top_row["congestion_score"]),
            "police_station": str(top_row["top_police_station"])
        }
        
    approved_count = int((df_violations["validation_status"] == "approved").sum())
    rejected_count = int((df_violations["validation_status"] == "rejected").sum())
    avg_approval_rate = float(approved_count / total_cases) if total_cases > 0 else 0
    
    return {
        "total_cases": total_cases,
        "approved": approved_count,
        "rejected": rejected_count,
        "avg_approval_rate": avg_approval_rate,
        "hotspots_count": hotspots_count,
        "enforcement_gaps": gap_count,
        "highest_risk_zone": top_zone
    }

@app.get("/api/hotspots")
def get_hotspots():
    if df_clusters.empty:
        return []
    
    # Return serializable records
    records = []
    for _, row in df_clusters.iterrows():
        records.append({
            "cluster_id": int(row["cluster_id"]),
            "violation_count": int(row["violation_count"]),
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
            "top_violation": str(row["top_violation"]),
            "avg_vehicle_weight": float(row["avg_vehicle_weight"]),
            "congestion_score": float(row["congestion_score"]),
            "approval_rate": float(row["approval_rate"]),
            "enforcement_gap_flag": bool(row["enforcement_gap_flag"]),
            "peak_hour": int(row["peak_hour"]),
            "top_police_station": str(row["top_police_station"])
        })
    return records

@app.get("/api/violations")
def get_violations(status: Optional[str] = "approved"):
    if df_violations.empty:
        return []
    
    filtered = df_violations
    if status:
        filtered = df_violations[df_violations["validation_status"] == status]
        
    # Return coordinates, status, and weights for mapping
    records = []
    # Drop rows without coords
    valid_coords = filtered.dropna(subset=["latitude", "longitude"])
    
    # Limit number of points sent to map for frontend performance if too many
    sample_df = valid_coords.head(1000) # Send up to 1000 records
    
    for _, row in sample_df.iterrows():
        records.append({
            "lat": float(row["latitude"]),
            "lon": float(row["longitude"]),
            "status": str(row["validation_status"]),
            "violation": str(row["primary_violation"]),
            "vehicle": str(row["vehicle_type"]),
            "time": row["created_datetime"].isoformat() if hasattr(row["created_datetime"], "isoformat") else str(row["created_datetime"]),
            "cluster": int(row["cluster"])
        })
    return records

@app.get("/api/shifts")
def get_shifts_data():
    if df_violations.empty:
        return {}
    
    shifts = {
        "Morning": (6, 11),
        "Afternoon": (12, 16),
        "Evening": (17, 21),
        "Night": (22, 5) # 22:00 to 05:00 next day
    }
    
    results = {}
    for shift_name, (h_start, h_end) in shifts.items():
        if shift_name == "Night":
            shift_df = df_violations[(df_violations["hour"] >= h_start) | (df_violations["hour"] <= h_end)]
        else:
            shift_df = df_violations[df_violations["hour"].between(h_start, h_end)]
            
        if shift_df.empty:
            results[shift_name] = {"total": 0, "top_violation": "None", "top_hotspots": [], "has_gap_zone": False}
            continue
            
        total_violations = len(shift_df)
        top_violation = str(shift_df["primary_violation"].mode().iloc[0]) if not shift_df["primary_violation"].mode().empty else "Unknown"
        
        # Get top hotspots in this shift
        shift_clustered = shift_df[shift_df["cluster"] != -1]
        top_hotspots = []
        has_gap_zone = False
        
        if not shift_clustered.empty and not df_clusters.empty:
            shift_counts = shift_clustered.groupby("cluster").size().reset_index(name="count")
            shift_counts = shift_counts.sort_values("count", ascending=False).head(3)
            
            for _, sc in shift_counts.iterrows():
                cid = int(sc["cluster"])
                cnt = int(sc["count"])
                match = df_clusters[df_clusters["cluster_id"] == cid]
                if not match.empty:
                    info = match.iloc[0]
                    is_gap = bool(info["enforcement_gap_flag"])
                    if is_gap:
                        has_gap_zone = True
                    top_hotspots.append({
                        "cluster_id": cid,
                        "lat": float(info["lat"]),
                        "lon": float(info["lon"]),
                        "count": cnt,
                        "primary_offence": str(info["top_violation"]),
                        "police_station": str(info["top_police_station"]),
                        "is_gap": is_gap
                    })
                    
        results[shift_name] = {
            "total": total_violations,
            "top_violation": top_violation,
            "top_hotspots": top_hotspots,
            "has_gap_zone": has_gap_zone,
            "hours": f"{h_start:02d}:00–{h_end:02d}:00"
        }
    return results

@app.get("/api/stations")
def get_stations():
    if df_violations.empty:
        return []
    stations = df_violations["police_station"].dropna().unique().tolist()
    return sorted(stations)

@app.get("/api/station/{station_name}")
def get_station_data(station_name: str):
    if df_violations.empty:
        raise HTTPException(status_code=404, detail="Data empty")
        
    sdf = df_violations[df_violations["police_station"].str.lower() == station_name.lower()]
    if sdf.empty:
        raise HTTPException(status_code=404, detail=f"No data for station {station_name}")
        
    total_cases = len(sdf)
    approved_cases = int((sdf["validation_status"] == "approved").sum())
    approval_rate = float(approved_cases / total_cases) if total_cases > 0 else 0
    
    avg_resolution = sdf["resolution_hours"].dropna().mean()
    avg_resolution = float(avg_resolution) if pd.notna(avg_resolution) else None
    
    # Monthly trend
    monthly = sdf.groupby("month").size().to_dict()
    # Fill in months 1-5 if they are missing
    months_mapped = {str(m): int(monthly.get(m, 0)) for m in range(1, 6)}
    
    # Vehicle types
    vtype = sdf["vehicle_type"].value_counts().to_dict()
    
    # Top 3 violations
    top_v = sdf["primary_violation"].value_counts().head(3).to_dict()
    top_violations_list = [{"violation": k, "count": int(v)} for k, v in top_v.items()]
    
    # Top junctions
    junction_counts = sdf["junction_name"].value_counts().head(5).to_dict()
    top_junctions_list = [{"junction": k, "count": int(v)} for k, v in junction_counts.items()]
    
    # Enforcement gaps inside this station's jurisdiction
    station_clusters = df_clusters[df_clusters["top_police_station"].str.lower() == station_name.lower()]
    gaps_count = int(station_clusters["enforcement_gap_flag"].sum()) if not station_clusters.empty else 0
    station_hotspots_count = len(station_clusters)
    
    return {
        "station_name": station_name,
        "total_cases": total_cases,
        "approved_cases": approved_cases,
        "approval_rate": approval_rate,
        "avg_resolution_hours": avg_resolution,
        "monthly_trend": months_mapped,
        "vehicle_mix": vtype,
        "top_violations": top_violations_list,
        "top_junctions": top_junctions_list,
        "gaps_count": gaps_count,
        "hotspots_count": station_hotspots_count
    }

@app.get("/api/mapmyindia/html", response_class=HTMLResponse)
def get_mapmyindia_html():
    api_key = os.getenv("MAPMYINDIA_API_KEY", "")
    if not api_key:
        return "<h3>MapmyIndia API Key not configured in .env file.</h3>"
        
    template_path = os.path.join("components", "mapmyindia_map.html")
    if not os.path.exists(template_path):
        return "<h3>MapmyIndia map template not found.</h3>"
        
    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()
        
    # Get hotspot data
    if df_clusters.empty:
        hotspot_json = []
    else:
        top20 = df_clusters.head(20)
        hotspot_json = top20[
            ["cluster_id", "lat", "lon", "congestion_score",
             "violation_count", "top_violation", "top_police_station"]
        ].to_dict(orient="records")
        
    html = html.replace("{API_KEY}", api_key)
    html = html.replace("__HOTSPOT_DATA__", json.dumps(hotspot_json))
    return html

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)
