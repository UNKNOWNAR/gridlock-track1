import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN


def find_hotspots(
    df: pd.DataFrame, eps_meters: int = 150, min_samples: int = 5
) -> pd.DataFrame:
    mask = (
        (df["validation_status"] == "approved")
        & df["latitude"].notna()
        & df["longitude"].notna()
    )
    filtered = df.loc[mask].copy()
    if filtered.empty:
        df["cluster"] = -1
        return df

    coords = np.radians(filtered[["latitude", "longitude"]].values)
    db = DBSCAN(
        eps=eps_meters / 6_371_000,
        min_samples=min_samples,
        metric="haversine",
        algorithm="ball_tree",
    )
    filtered["cluster"] = db.fit_predict(coords)
    df["cluster"] = -1
    df.loc[filtered.index, "cluster"] = filtered["cluster"]
    return df
