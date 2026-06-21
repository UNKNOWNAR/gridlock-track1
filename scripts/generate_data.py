import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Create directories
os.makedirs("data", exist_ok=True)
os.makedirs("scripts", exist_ok=True)

# Seed for reproducibility
np.random.seed(42)

# Hotspot definitions (lat, lon, station, junction, base_offence_code, primary_vehicle_types, expected_approval_rate)
locations = [
    # Indiranagar - Commercial / Metro (High violations, lower approval -> Enforcement Gap)
    (12.9784, 77.6408, "Indiranagar", "100 Feet Rd & 12th Main", "113", ["CAR", "SCOOTER"], 0.52),
    # Koramangala - Commercial (Sony World Signal)
    (12.9348, 77.6189, "Koramangala", "Sony World Signal", "107", ["CAR", "VAN", "SCOOTER"], 0.75),
    # Majestic - Transit Hub
    (12.9779, 77.5724, "Majestic", "Majestic Metro Station", "112", ["PASSENGER", "GOODS AUTO", "SCOOTER"], 0.82),
    # MG Road - Commercial / Metro
    (12.9743, 77.6111, "Cubbon Park", "MG Road Metro Station", "113", ["CAR", "SCOOTER"], 0.68),
    # Silk Board - Heavy Traffic Intersection
    (12.9176, 77.6244, "Madiwala", "Silk Board Junction", "107", ["TANKER", "GOODS AUTO", "VAN"], 0.58),
    # Halasuru - Residential / Market spillover
    (12.9754, 77.6298, "Halasuru", "Lido Mall Junction", "177", ["SCOOTER", "CAR"], 0.72)
]

num_records = 1500
records = []

start_date = datetime(2024, 1, 1)
end_date = datetime(2024, 5, 31)
date_range_days = (end_date - start_date).days

for i in range(num_records):
    # Choose a location cluster, occasionally add a completely random noise point
    if np.random.random() < 0.15:
        # Noise point (random coordinates around Bangalore, random station)
        lat = 12.9716 + np.random.uniform(-0.06, 0.06)
        lon = 77.5946 + np.random.uniform(-0.06, 0.06)
        station = np.random.choice(["Koramangala", "Indiranagar", "Cubbon Park", "Majestic", "Halasuru", "Madiwala"])
        junction = "Random Junction Spot"
        offence = np.random.choice(["112", "113", "104", "107", "105", "177"])
        vehicle = np.random.choice(["CAR", "SCOOTER", "VAN", "PASSENGER", "GOODS AUTO", "TANKER"])
        approval_rate = 0.65
    else:
        # Clustered hotspot point
        loc = locations[np.random.choice(len(locations))]
        # Add slight gaussian noise to lat/lon for clustering
        lat = loc[0] + np.random.normal(0, 0.0006)
        lon = loc[1] + np.random.normal(0, 0.0006)
        station = loc[2]
        junction = loc[3]
        # Mix in other offences occasionally
        offence = loc[4] if np.random.random() < 0.7 else np.random.choice(["112", "113", "104", "107", "105", "177"])
        vehicle = np.random.choice(loc[5]) if np.random.random() < 0.85 else np.random.choice(["CAR", "SCOOTER", "VAN", "PASSENGER", "GOODS AUTO", "TANKER"])
        approval_rate = loc[6]

    # Date and time generation
    random_days = int(np.random.randint(0, date_range_days))
    # Peak hours: Morning (8-11), Evening (17-21)
    if np.random.random() < 0.65:
        hour = int(np.random.choice([8, 9, 10, 17, 18, 19, 20]))
    else:
        hour = int(np.random.randint(0, 24))
        
    minute = int(np.random.randint(0, 60))
    second = int(np.random.randint(0, 60))
    
    created_time = start_date + timedelta(days=random_days, hours=hour, minutes=minute, seconds=second)
    
    # Validation status (based on approval rate)
    status = "approved" if np.random.random() < approval_rate else "rejected"
    
    # Resolution duration (1 to 12 hours for approved, or sometimes longer)
    if status == "approved":
        res_hours = float(np.random.uniform(0.5, 8.0) if np.random.random() < 0.9 else np.random.uniform(10.0, 36.0))
        closed_time = created_time + timedelta(hours=res_hours)
    else:
        # Rejected/cancelled are resolved quickly
        closed_time = created_time + timedelta(minutes=int(np.random.randint(10, 120)))

    # Formatted datetime strings
    created_str = created_time.strftime("%Y-%m-%d %H:%M:%S UTC")
    closed_str = closed_time.strftime("%Y-%m-%d %H:%M:%S UTC")

    records.append({
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "created_datetime": created_str,
        "closed_datetime": closed_str,
        "offence_code": offence,
        "validation_status": status,
        "vehicle_type": vehicle,
        "police_station": station,
        "junction_name": junction
    })

df = pd.DataFrame(records)
df.to_csv("data/violations.csv", index=False)
print(f"Generated {len(df)} fake records in data/violations.csv")
