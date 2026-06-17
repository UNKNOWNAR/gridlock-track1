import pandas as pd


def load_violations(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df.dropna(subset=["latitude", "longitude"], how="all")
    df["created_datetime"] = pd.to_datetime(df["created_datetime"], errors="coerce", utc=True)
    df["closed_datetime"] = pd.to_datetime(df["closed_datetime"], errors="coerce", utc=True)
    df["hour"] = df["created_datetime"].dt.hour
    df["day_of_week"] = df["created_datetime"].dt.dayofweek
    df["month"] = df["created_datetime"].dt.month
    df["resolution_hours"] = (
        (df["closed_datetime"] - df["created_datetime"]).dt.total_seconds() / 3600
    )
    return df
