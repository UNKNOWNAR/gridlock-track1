"""
trend_engine.py
Week-over-week violation trend analysis per cluster and overall.
"""
import pandas as pd
import numpy as np


def compute_weekly_trends(df: pd.DataFrame) -> dict:
    """
    Compute weekly violation counts and trends.

    Returns a dict with:
      - 'overall'       : DataFrame of (year_week, week_label, count, delta_pct, trend)
      - 'by_cluster'    : DataFrame of (cluster_id, year_week, count, delta_pct, trend)
      - 'cluster_trend' : Series indexed by cluster_id with overall trend direction
    """
    if "year_week" not in df.columns or "week" not in df.columns:
        return {"overall": pd.DataFrame(), "by_cluster": pd.DataFrame(), "cluster_trend": pd.Series(dtype=str)}

    approved = df[df["validation_status"] == "approved"].copy()

    # ── Overall city-wide weekly trend ───────────────────────────────────────
    overall = (
        approved.groupby("year_week")
        .size()
        .reset_index(name="count")
        .sort_values("year_week")
    )
    overall["delta_pct"] = overall["count"].pct_change() * 100
    overall["trend"] = overall["delta_pct"].apply(
        lambda d: "▲ Rising" if d >= 15 else ("▼ Falling" if d <= -15 else "→ Stable")
        if pd.notna(d) else "→ Stable"
    )

    # ── Per-cluster weekly trend ─────────────────────────────────────────────
    clustered = approved[approved["cluster"] != -1]
    if clustered.empty:
        by_cluster = pd.DataFrame()
        cluster_trend = pd.Series(dtype=str)
    else:
        by_cluster = (
            clustered.groupby(["cluster", "year_week"])
            .size()
            .reset_index(name="count")
            .sort_values(["cluster", "year_week"])
        )
        by_cluster["delta_pct"] = by_cluster.groupby("cluster")["count"].pct_change() * 100
        by_cluster["trend"] = by_cluster["delta_pct"].apply(
            lambda d: "▲ Rising" if d >= 15 else ("▼ Falling" if d <= -15 else "→ Stable")
            if pd.notna(d) else "→ Stable"
        )
        by_cluster.rename(columns={"cluster": "cluster_id"}, inplace=True)

        # Latest trend direction per cluster
        latest = by_cluster.sort_values("year_week").groupby("cluster_id").tail(1)
        cluster_trend = latest.set_index("cluster_id")["trend"]

    return {
        "overall": overall,
        "by_cluster": by_cluster,
        "cluster_trend": cluster_trend,
    }


def get_trending_zones(cluster_stats: pd.DataFrame, cluster_trend: pd.Series) -> pd.DataFrame:
    """
    Merge cluster_trend (Series) into cluster_stats DataFrame.
    Returns cluster_stats with a 'trend' column added.
    """
    if cluster_trend.empty:
        cluster_stats["trend"] = "→ Stable"
        return cluster_stats
    stats = cluster_stats.copy()
    stats["trend"] = stats["cluster_id"].map(cluster_trend).fillna("→ Stable")
    return stats
