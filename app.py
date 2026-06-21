import os
import json
import math
import streamlit as st
import pandas as pd
import numpy as np
import folium
from folium.plugins import HeatMap
import plotly.express as px
import plotly.graph_objects as go
import streamlit.components.v1 as components
from dotenv import load_dotenv

from modules.data_loader import load_violations
from modules.violation_decoder import decode_violations
from modules.clustering import find_hotspots
from modules.scoring import score_clusters
from modules.trend_engine import compute_weekly_trends, get_trending_zones
from modules.patrol_scheduler import generate_patrol_schedule, schedule_summary

load_dotenv()

st.set_page_config(
    page_title="BTP Enforcement Intelligence",
    layout="wide",
    page_icon="\U0001f6a6",
)

st.markdown("""<style>
[data-testid="stSidebar"] { background-color: #0f1923; }
[data-testid="stSidebar"] * { color: #e8e8e8 !important; }
.stMetric { background: #f7f7f7; border-left: 3px solid #c0392b;
            padding: 8px 12px; border-radius: 4px; }
div[data-testid="stWarning"] { border-left: 3px solid #c0392b;
                                background: #fff5f5; }
.impact-CRITICAL { color: #c0392b; font-weight: bold; }
.impact-HIGH { color: #e67e22; font-weight: bold; }
.impact-MODERATE { color: #f39c12; font-weight: bold; }
.impact-LOW { color: #27ae60; }
footer { visibility: hidden; }
</style>""", unsafe_allow_html=True)

FOOTER = "<p style='color:#aaa;font-size:11px;margin-top:40px'>BTP × Flipkart Gridlock 2.0 | Data: Nov 2023–Apr 2024 | Built for operational use</p>"

IMPACT_COLORS = {"CRITICAL": "#c0392b", "HIGH": "#e67e22", "MODERATE": "#f39c12", "LOW": "#27ae60"}
SEVERITY_COLORS = {"CRITICAL": "#c0392b", "HIGH": "#e67e22", "MODERATE": "#f1c40f", "OTHER": "#95a5a6"}
LOC_COLORS = {"metro_station": "#8e44ad", "commercial": "#2980b9", "main_road": "#c0392b",
              "hospital_school": "#16a085", "residential": "#7f8c8d", "unknown": "#bdc3c7"}


@st.cache_data
def get_data():
    df = load_violations("data/violations.csv")
    df = decode_violations(df)
    df = find_hotspots(df)
    cluster_stats = score_clusters(df)
    trends = compute_weekly_trends(df)
    cluster_stats = get_trending_zones(cluster_stats, trends["cluster_trend"])
    schedule = generate_patrol_schedule(cluster_stats)
    return df, cluster_stats, trends, schedule


df, cluster_stats, trends, patrol_schedule = get_data()

# ─── SIDEBAR ─────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("<p style='color:#7f8c8d;font-size:12px;margin-bottom:0'>BTP × Gridlock 2.0</p>", unsafe_allow_html=True)
    st.markdown("---")

    # Date range filter
    valid_dates = df["created_datetime_ist"].dropna().dt.date
    if len(valid_dates) > 0:
        min_date = valid_dates.min()
        max_date = valid_dates.max()
        date_range = st.date_input(
            "Date Range",
            value=(min_date, max_date),
            min_value=min_date,
            max_value=max_date,
        )
    else:
        import datetime
        min_date = datetime.date(2023, 11, 1)
        max_date = datetime.date(2024, 5, 31)
        date_range = (min_date, max_date)

    # Violation category filter
    st.markdown("**Violation Severity**")
    cat_critical = st.checkbox("🔴 Critical", value=True)
    cat_high = st.checkbox("🟠 High", value=True)
    cat_moderate = st.checkbox("🟡 Moderate", value=True)

    # Location type filter
    st.markdown("**Location Type**")
    loc_all = st.checkbox("All", value=True)
    if not loc_all:
        selected_locs = st.multiselect(
            "Location types",
            ["metro_station", "commercial", "main_road", "hospital_school", "residential"],
            default=["metro_station", "commercial", "main_road"],
        )
    else:
        selected_locs = ["metro_station", "commercial", "main_road", "hospital_school", "residential", "unknown"]

    st.markdown("---")
    st.markdown(f"**Total records:** {len(df):,}")
    approved_count = (df["validation_status"] == "approved").sum()
    rejected_count = (df["validation_status"] == "rejected").sum()
    st.markdown(f"**Approved:** {approved_count:,}")
    st.markdown(f"**Rejected:** {rejected_count:,}")
    st.markdown("---")

    page = st.radio(
        "Navigation",
        ["Zone Intelligence", "Parking Intelligence", "Congestion Impact",
         "Risk Scoring", "Shift Deployment", "Station Analysis",
         "Patrol Planner", "MapmyIndia View"],
        label_visibility="collapsed",
    )

# ─── APPLY FILTERS ───────────────────────────────────────────────────────────
selected_cats = []
if cat_critical:
    selected_cats.append("CRITICAL")
if cat_high:
    selected_cats.append("HIGH")
if cat_moderate:
    selected_cats.append("MODERATE")
if not selected_cats:
    selected_cats = ["CRITICAL", "HIGH", "MODERATE", "OTHER"]

# Filter main dataframe
date_mask = pd.Series([True] * len(df), index=df.index)
if len(date_range) == 2:
    start_d, end_d = date_range
    valid_dt = df["created_datetime_ist"].notna()
    date_mask = valid_dt & (
        df["created_datetime_ist"].dt.date >= start_d
    ) & (
        df["created_datetime_ist"].dt.date <= end_d
    )

fdf = df[
    date_mask
    & df["parking_category"].isin(selected_cats + ["OTHER"])
    & df["location_type"].isin(selected_locs)
].copy()

# Filter cluster_stats by impact_category and location_type
fcs = cluster_stats[
    cluster_stats["impact_category"].isin(selected_cats + ["LOW"])
    & cluster_stats["location_type"].isin(selected_locs)
].copy() if not cluster_stats.empty else cluster_stats


# ─── PAGE 1: Zone Intelligence ────────────────────────────────────────────────
if page == "Zone Intelligence":
    st.header("Zone Intelligence")

    gap_count = int(fcs["enforcement_gap_flag"].sum()) if not fcs.empty else 0
    top_zone = fcs.iloc[0] if not fcs.empty else None

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Cases", f"{len(fdf):,}")
    c2.metric("Hotspot Zones", f"{len(fcs)}")
    c3.metric("Highest Risk Zone",
              f"{top_zone['lat']:.4f}, {top_zone['lon']:.4f}" if top_zone is not None else "N/A")
    c4.metric("Enforcement Gaps", f"{gap_count}")

    m = folium.Map(location=[12.9716, 77.5946], zoom_start=12, tiles="cartodbpositron")

    approved_df = fdf[(fdf["validation_status"] == "approved") & fdf["latitude"].notna() & fdf["longitude"].notna()]
    if not approved_df.empty and not fcs.empty:
        heat_data = []
        for _, row in approved_df.iterrows():
            weight = float(row.get("congestion_severity", 1))
            heat_data.append([row["latitude"], row["longitude"], weight])
        HeatMap(heat_data, radius=15, blur=10, max_zoom=13).add_to(m)

    top15 = fcs.head(15) if not fcs.empty else pd.DataFrame()
    for _, cl in top15.iterrows():
        color = IMPACT_COLORS.get(cl.get("impact_category", "MODERATE"), "#e67e22")
        radius = max(5, min(cl["congestion_score"] / 20, 30))
        trend_icon = str(cl.get("trend", "→ Stable")).split()[0]
        popup_text = (
            f"Zone {cl['cluster_id']} {trend_icon} | {cl['top_violation']} | "
            f"Cases: {cl['violation_count']} | Impact: {cl.get('impact_category','?')} | "
            f"Delay: {cl.get('estimated_delay_minutes',0):.0f} min | "
            f"Recommended: Deploy {math.ceil(cl['congestion_score']/50)} personnel"
        )
        folium.CircleMarker(
            location=[cl["lat"], cl["lon"]],
            radius=radius,
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.7,
            popup=folium.Popup(popup_text, max_width=320),
        ).add_to(m)

    components.html(m._repr_html_(), height=500)

    with st.expander("Enforcement Gap Analysis"):
        gap_zones = fcs[fcs["enforcement_gap_flag"]] if not fcs.empty else pd.DataFrame()
        if len(gap_zones) > 0:
            st.markdown(
                f"<span style='color:#c0392b'>⚠ {len(gap_zones)} zones show approval rate below 60% — likely under-patrolled</span>",
                unsafe_allow_html=True,
            )
            display_gaps = gap_zones[[
                "cluster_id", "violation_count", "approval_rate", "top_violation",
                "top_police_station", "impact_category", "trend"
            ]].copy()
            display_gaps.columns = ["Zone", "Cases", "Approval Rate", "Primary Offence",
                                    "Nearest Station", "Impact", "Trend"]
            st.dataframe(display_gaps, use_container_width=True, hide_index=True)
        else:
            st.info("No enforcement gaps detected.")

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 2: Parking Intelligence ─────────────────────────────────────────────
elif page == "Parking Intelligence":
    st.header("Parking Intelligence")
    st.caption("AI-driven analysis of illegal parking hotspots across Bengaluru")

    # KPI tiles by location type
    loc_counts = fdf.groupby("location_type").size()
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Metro Area", f"{loc_counts.get('metro_station', 0):,}")
    c2.metric("Commercial", f"{loc_counts.get('commercial', 0):,}")
    c3.metric("Main Road", f"{loc_counts.get('main_road', 0):,}")
    c4.metric("Hospital/School", f"{loc_counts.get('hospital_school', 0):,}")
    c5.metric("Residential", f"{loc_counts.get('residential', 0):,}")

    st.markdown("---")
    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("Violation Severity Distribution")
        cat_counts = fdf["parking_category"].value_counts().reset_index()
        cat_counts.columns = ["Severity", "Count"]
        fig_donut = px.pie(
            cat_counts, names="Severity", values="Count",
            color="Severity",
            color_discrete_map=SEVERITY_COLORS,
            hole=0.5,
        )
        fig_donut.update_traces(textposition="outside", textinfo="percent+label")
        fig_donut.update_layout(showlegend=False, margin=dict(t=20, b=0, l=0, r=0), height=320)
        st.plotly_chart(fig_donut, use_container_width=True)

    with col_right:
        st.subheader("Location Context Breakdown")
        loc_df = fdf.groupby("location_type").size().reset_index(name="count")
        loc_df["location_type"] = loc_df["location_type"].str.replace("_", " ").str.title()
        loc_df = loc_df.sort_values("count", ascending=True)
        fig_loc = px.bar(
            loc_df, x="count", y="location_type", orientation="h",
            color="location_type",
            color_discrete_sequence=list(LOC_COLORS.values()),
            labels={"count": "Violations", "location_type": ""},
        )
        fig_loc.update_layout(showlegend=False, plot_bgcolor="white", height=320,
                               margin=dict(t=20, b=0, l=0, r=0))
        st.plotly_chart(fig_loc, use_container_width=True)

    st.markdown("---")
    st.subheader("Violation Sub-Type Breakdown")
    # Parse all sub-types from filtered data
    import json as _json
    sub_type_counts = {}
    for val in fdf["violation_type"].dropna():
        try:
            types = _json.loads(val)
            for t in types:
                sub_type_counts[t] = sub_type_counts.get(t, 0) + 1
        except Exception:
            pass
    if sub_type_counts:
        sub_df = pd.DataFrame(list(sub_type_counts.items()), columns=["Violation Type", "Count"])
        sub_df = sub_df.sort_values("Count", ascending=False)
        fig_sub = px.bar(
            sub_df, x="Count", y="Violation Type", orientation="h",
            color="Count",
            color_continuous_scale=[[0, "#f39c12"], [0.5, "#e67e22"], [1, "#c0392b"]],
        )
        fig_sub.update_layout(
            showlegend=False, coloraxis_showscale=False,
            plot_bgcolor="white", height=420,
            yaxis=dict(categoryorder="total ascending"),
            margin=dict(t=20, b=0),
        )
        st.plotly_chart(fig_sub, use_container_width=True)

    st.markdown("---")
    st.subheader("Top Parking Hotspots by Impact")
    if not fcs.empty:
        top_hotspots = fcs.head(25)[[
            "cluster_id", "junction_label", "top_police_station", "location_type",
            "violation_count", "parking_category", "impact_category",
            "estimated_delay_minutes", "carriageway_blockage_pct", "trend"
        ]].copy()
        top_hotspots["location_type"] = top_hotspots["location_type"].str.replace("_", " ").str.title()
        top_hotspots.columns = [
            "Zone", "Junction", "Station", "Location Type",
            "Cases", "Severity", "Impact",
            "Est. Delay (min)", "Road Blockage %", "Trend"
        ]
        st.dataframe(
            top_hotspots,
            column_config={
                "Est. Delay (min)": st.column_config.NumberColumn(format="%.0f"),
                "Road Blockage %": st.column_config.ProgressColumn(
                    min_value=0, max_value=100, format="%.1f%%"
                ),
                "Impact": st.column_config.TextColumn(),
            },
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.info("No hotspot data available for current filters.")

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 3: Congestion Impact ────────────────────────────────────────────────
elif page == "Congestion Impact":
    st.header("Congestion Impact Analysis")
    st.caption("Quantifying how parking violations translate into traffic delay and carriageway loss")

    if fcs.empty:
        st.info("No data available for current filters.")
    else:
        total_delay = fcs["estimated_delay_minutes"].sum()
        total_delay_hours = total_delay / 60
        critical_events = int((fcs["impact_category"] == "CRITICAL").sum())
        unique_junctions = fdf["junction_label"].nunique()
        # Peak impact hour from CRITICAL violations
        critical_rows = fdf[fdf["parking_category"] == "CRITICAL"]
        peak_impact_hour = int(critical_rows["hour"].mode().iloc[0]) if not critical_rows.empty else 0

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Estimated Delay", f"{total_delay_hours:,.0f} hrs",
                  help="Cumulative vehicle-hours of delay caused by parking violations across all hotspot zones")
        c2.metric("Critical Blockage Zones", f"{critical_events}",
                  help="Zones where estimated delay exceeds 500 minutes/period")
        c3.metric("Unique Junctions Affected", f"{unique_junctions:,}")
        c4.metric("Peak Impact Hour (IST)", f"{peak_impact_hour:02d}:00")

        st.markdown("---")

        col_l, col_r = st.columns(2)

        with col_l:
            st.subheader("Hour × Violation Severity Heatmap")
            # Build pivot: hour (0-23) vs parking_category
            pivot = (
                fdf[fdf["parking_category"] != "OTHER"]
                .groupby(["hour", "parking_category"])
                .size()
                .unstack(fill_value=0)
            )
            # Ensure all hours 0-23 and all categories
            for cat in ["CRITICAL", "HIGH", "MODERATE"]:
                if cat not in pivot.columns:
                    pivot[cat] = 0
            pivot = pivot.reindex(range(24), fill_value=0)[["CRITICAL", "HIGH", "MODERATE"]]
            fig_heat = go.Figure(data=go.Heatmap(
                z=pivot.values.T,
                x=[f"{h:02d}:00" for h in pivot.index],
                y=["CRITICAL", "HIGH", "MODERATE"],
                colorscale=[[0, "#fff9f9"], [0.5, "#e67e22"], [1, "#c0392b"]],
                showscale=True,
            ))
            fig_heat.update_layout(
                height=300,
                margin=dict(t=20, b=40, l=80, r=20),
                xaxis_title="Hour of Day (IST)",
                yaxis_title="",
            )
            st.plotly_chart(fig_heat, use_container_width=True)

        with col_r:
            st.subheader("Vehicle Type → Carriageway Blockage")
            # Avg block pct approximation per vehicle type from filtered data
            veh_block = {
                "HGV/TANKER": 0.45, "Private Bus": 0.40, "LGV": 0.28,
                "Van/Tempo": 0.22, "Maxi-Cab": 0.18, "Car": 0.15,
                "Auto": 0.10, "Scooter/Bike": 0.05,
            }
            veh_df = pd.DataFrame(list(veh_block.items()), columns=["Vehicle Type", "Avg Road Blockage %"])
            veh_df["Avg Road Blockage %"] = veh_df["Avg Road Blockage %"] * 100
            veh_df = veh_df.sort_values("Avg Road Blockage %", ascending=True)
            fig_veh = px.bar(
                veh_df, x="Avg Road Blockage %", y="Vehicle Type",
                orientation="h",
                color="Avg Road Blockage %",
                color_continuous_scale=[[0, "#7f8c8d"], [1, "#c0392b"]],
            )
            fig_veh.update_layout(
                showlegend=False, coloraxis_showscale=False,
                plot_bgcolor="white", height=300,
                margin=dict(t=20, b=40, l=10, r=20),
            )
            st.plotly_chart(fig_veh, use_container_width=True)

        st.markdown("---")
        st.subheader("Junction Risk Ranking")
        # Junctions with named BTP code (not "No Junction")
        junc_risk = (
            fdf[fdf["junction_label"] != "No Junction"]
            .groupby(["junction_id", "junction_label", "police_station"])
            .agg(
                violation_count=("id", "count"),
                critical_count=("parking_category", lambda x: (x == "CRITICAL").sum()),
                avg_severity=("congestion_severity", "mean"),
            )
            .reset_index()
            .sort_values("critical_count", ascending=False)
            .head(20)
        )
        if not junc_risk.empty:
            junc_risk.columns = ["Junction ID", "Junction Name", "Police Station",
                                  "Total Violations", "Critical Violations", "Avg Severity"]
            junc_risk["Avg Severity"] = junc_risk["Avg Severity"].round(2)
            st.dataframe(junc_risk, use_container_width=True, hide_index=True)
        else:
            st.info("No named junction data available.")

        st.markdown("---")
        st.subheader("Week-over-Week City Trend")
        overall_trend = trends.get("overall", pd.DataFrame())
        if not overall_trend.empty:
            fig_trend = go.Figure()
            fig_trend.add_trace(go.Scatter(
                x=overall_trend["year_week"],
                y=overall_trend["count"],
                mode="lines+markers",
                line=dict(color="#c0392b", width=2),
                marker=dict(size=6),
                name="Weekly Violations",
            ))
            fig_trend.update_layout(
                plot_bgcolor="white",
                height=300,
                margin=dict(t=20, b=40, l=40, r=20),
                xaxis_title="Week",
                yaxis_title="Violations",
                xaxis=dict(tickangle=-45),
            )
            st.plotly_chart(fig_trend, use_container_width=True)
        else:
            st.info("Trend data not available.")

        # Export report
        csv_data = fcs.drop(columns=["vehicle_type_mix"], errors="ignore").to_csv(index=False).encode("utf-8")
        st.download_button(
            "📥 Download Full Congestion Report (CSV)",
            csv_data,
            "gridlock_congestion_report.csv",
            "text/csv",
        )

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 4: Risk Scoring ─────────────────────────────────────────────────────
elif page == "Risk Scoring":
    st.header("Risk Scoring")

    if fcs.empty:
        st.info("No records found for selected filters.")
    else:
        top20 = fcs.head(20).copy()
        top20["zone_label"] = top20.apply(lambda r: f"Zone {r['cluster_id']}", axis=1)

        fig_bar = px.bar(
            top20,
            x="zone_label",
            y="estimated_delay_minutes",
            color="impact_category",
            color_discrete_map=IMPACT_COLORS,
            labels={"estimated_delay_minutes": "Est. Delay (min)", "zone_label": "Zone"},
        )
        fig_bar.update_layout(showlegend=True, plot_bgcolor="white")
        st.plotly_chart(fig_bar, use_container_width=True)

        fig_scatter = px.scatter_mapbox(
            fcs,
            lat="lat",
            lon="lon",
            size="violation_count",
            color="impact_category",
            color_discrete_map=IMPACT_COLORS,
            hover_data=["cluster_id", "violation_count", "top_violation",
                        "estimated_delay_minutes", "parking_category"],
            zoom=11,
            mapbox_style="open-street-map",
        )
        fig_scatter.update_layout(margin=dict(l=0, r=0, t=0, b=0), height=450)
        st.plotly_chart(fig_scatter, use_container_width=True)

        display_df = fcs[[
            "cluster_id", "impact_category", "parking_category", "estimated_delay_minutes",
            "carriageway_blockage_pct", "violation_count", "approval_rate",
            "enforcement_gap_flag", "top_violation", "peak_hour", "trend"
        ]].copy()
        st.dataframe(
            display_df,
            column_config={
                "cluster_id": "Zone",
                "impact_category": "Impact",
                "parking_category": "Severity",
                "estimated_delay_minutes": st.column_config.NumberColumn("Est. Delay (min)", format="%.0f"),
                "carriageway_blockage_pct": st.column_config.ProgressColumn(
                    "Road Blockage %", min_value=0, max_value=100, format="%.1f%%"
                ),
                "violation_count": "Cases",
                "approval_rate": "Approval Rate",
                "enforcement_gap_flag": "Gap Flagged",
                "top_violation": "Primary Offence",
                "peak_hour": "Peak Hour",
                "trend": "Trend",
            },
            use_container_width=True,
            hide_index=True,
        )

        csv_data = fcs.drop(columns=["vehicle_type_mix"], errors="ignore").to_csv(index=False).encode("utf-8")
        st.download_button("Download enforcement_zones.csv", csv_data, "enforcement_zones.csv", "text/csv")

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 5: Shift Deployment ─────────────────────────────────────────────────
elif page == "Shift Deployment":
    st.header("Shift Deployment")

    shifts = {
        "Morning (06–11)": (6, 11),
        "Afternoon (12–16)": (12, 16),
        "Evening (17–23)": (17, 23),
    }

    cols = st.columns(3)
    for col, (shift_name, (h_start, h_end)) in zip(cols, shifts.items()):
        with col:
            st.subheader(shift_name)
            shift_df = fdf[fdf["hour"].between(h_start, h_end)]
            if shift_df.empty or fcs.empty:
                st.info("No records found for selected filters.")
                continue

            shift_clustered = shift_df[shift_df["cluster"] != -1]
            if shift_clustered.empty:
                st.info("No records found for selected filters.")
                continue

            shift_counts = shift_clustered.groupby("cluster").size().reset_index(name="count")
            shift_counts = shift_counts.sort_values("count", ascending=False).head(5)

            for rank, (_, sc) in enumerate(shift_counts.iterrows(), 1):
                cid = sc["cluster"]
                match = fcs[fcs["cluster_id"] == cid]
                if match.empty:
                    continue
                info = match.iloc[0]
                impact = info.get("impact_category", "MODERATE")
                color = IMPACT_COLORS.get(impact, "#7f8c8d")
                st.markdown(
                    f"**{rank}.** {info['top_violation']} — "
                    f"{info['lat']:.4f}, {info['lon']:.4f} — {sc['count']} cases "
                    f"<span style='color:{color}'>●</span>",
                    unsafe_allow_html=True
                )

            vtype_counts = shift_df["primary_violation"].value_counts().head(8)
            fig = px.bar(
                x=vtype_counts.index,
                y=vtype_counts.values,
                labels={"x": "Violation Type", "y": "Count"},
                color_discrete_sequence=["#7f8c8d"],
            )
            fig.update_layout(showlegend=False, plot_bgcolor="white", height=250,
                              margin=dict(l=0, r=0, t=10, b=0))
            st.plotly_chart(fig, use_container_width=True)

            gap_in_shift = shift_clustered.merge(
                fcs[fcs["enforcement_gap_flag"]][["cluster_id"]],
                left_on="cluster", right_on="cluster_id", how="inner"
            )
            if not gap_in_shift.empty:
                st.markdown(
                    "<span style='color:#c0392b;font-weight:bold'>⚠ Gap zone active during this shift</span>",
                    unsafe_allow_html=True,
                )

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 6: Station Analysis ─────────────────────────────────────────────────
elif page == "Station Analysis":
    st.header("Station Analysis")

    stations = sorted(fdf["police_station"].dropna().unique())
    if not stations:
        st.info("No records found for selected filters.")
    else:
        selected = st.selectbox("Select Police Station", stations)
        sdf = fdf[fdf["police_station"] == selected]

        if sdf.empty:
            st.info("No records found for selected filters.")
        else:
            total_cases = len(sdf)
            station_approved = (sdf["validation_status"] == "approved").sum()
            station_approval_rate = station_approved / total_cases if total_cases > 0 else 0
            avg_res = sdf["resolution_hours"].dropna().mean()
            critical_pct = (sdf["parking_category"] == "CRITICAL").mean()

            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Total Cases", f"{total_cases:,}")
            c2.metric("Approval Rate", f"{station_approval_rate:.1%}")
            c3.metric("Avg Resolution (hrs)", f"{avg_res:.1f}" if pd.notna(avg_res) else "N/A")
            c4.metric("Critical Violations %", f"{critical_pct:.1%}")

            if station_approval_rate < 0.6:
                st.markdown(
                    "<span style='color:#c0392b'>⚠ Low approval rate — review enforcement quality</span>",
                    unsafe_allow_html=True,
                )

            col_l, col_r = st.columns(2)
            with col_l:
                monthly = sdf.groupby("month").size().reset_index(name="count")
                fig_month = px.bar(
                    monthly, x="month", y="count",
                    labels={"month": "Month", "count": "Violations"},
                    color_discrete_sequence=["#7f8c8d"],
                )
                fig_month.update_layout(plot_bgcolor="white")
                st.plotly_chart(fig_month, use_container_width=True)

            with col_r:
                cat_breakdown = sdf["parking_category"].value_counts().reset_index()
                cat_breakdown.columns = ["Severity", "Count"]
                fig_cat = px.pie(
                    cat_breakdown, names="Severity", values="Count",
                    color="Severity", color_discrete_map=SEVERITY_COLORS, hole=0.4,
                )
                fig_cat.update_layout(height=300, margin=dict(t=20, b=0))
                st.plotly_chart(fig_cat, use_container_width=True)

            st.markdown("**Top 3 violations:**")
            top_v = sdf["primary_violation"].value_counts().head(3)
            for vname, vcount in top_v.items():
                st.markdown(f"- {vname}: {vcount:,} cases")

            junction_counts = (
                sdf[sdf["junction_label"] != "No Junction"]
                .groupby("junction_label")
                .size()
                .reset_index(name="Cases")
                .sort_values("Cases", ascending=False)
            )
            junction_counts.columns = ["Junction", "Cases"]
            st.dataframe(junction_counts, use_container_width=True, hide_index=True)

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 7: Patrol Planner ───────────────────────────────────────────────────
elif page == "Patrol Planner":
    st.header("Patrol Planner")
    st.caption("AI-generated daily enforcement deployment schedule based on hotspot risk scoring")

    if patrol_schedule.empty:
        st.info("No patrol schedule available.")
    else:
        summary = schedule_summary(patrol_schedule)

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Zones to Cover", summary.get("total_zones", 0))
        c2.metric("Critical Zones", summary.get("critical_zones", 0))
        c3.metric("Officers Recommended", summary.get("total_personnel", 0))
        c4.metric("Enforcement Gaps", summary.get("enforcement_gaps", 0))

        st.markdown(f"**Busiest Shift:** {summary.get('top_shift','N/A')} &nbsp;|&nbsp; "
                    f"**Most Active Station:** {summary.get('top_station','N/A')}",
                    unsafe_allow_html=True)

        st.markdown("---")

        # Shift filter
        all_shifts = sorted(patrol_schedule["peak_shift"].unique())
        shift_filter = st.selectbox("Filter by Shift", ["All Shifts"] + list(all_shifts))

        display_sched = patrol_schedule.copy()
        if shift_filter != "All Shifts":
            display_sched = display_sched[display_sched["peak_shift"] == shift_filter]

        st.subheader(f"Deployment Schedule ({len(display_sched)} zones)")
        show_cols = [
            "priority", "area_name", "police_station", "location_type",
            "peak_shift", "peak_day", "impact_category", "parking_category",
            "estimated_delay_min", "personnel_needed", "enforcement_gap"
        ]
        disp = display_sched[show_cols].copy()
        disp.columns = [
            "Priority", "Area / Junction", "Station", "Location Type",
            "Deployment Shift", "Peak Day", "Impact", "Severity",
            "Est. Delay (min)", "Officers Needed", "Has Gap"
        ]
        st.dataframe(
            disp,
            column_config={
                "Est. Delay (min)": st.column_config.NumberColumn(format="%.0f"),
                "Officers Needed": st.column_config.NumberColumn(),
                "Has Gap": st.column_config.CheckboxColumn(),
                "Priority": st.column_config.NumberColumn(),
            },
            use_container_width=True,
            hide_index=True,
        )

        st.markdown("---")
        st.subheader("Station-wise Officer Workload")
        station_workload = (
            display_sched.groupby("police_station")["personnel_needed"]
            .sum()
            .reset_index()
            .sort_values("personnel_needed", ascending=False)
            .head(20)
        )
        fig_workload = px.bar(
            station_workload,
            x="personnel_needed",
            y="police_station",
            orientation="h",
            color="personnel_needed",
            color_continuous_scale=[[0, "#7f8c8d"], [1, "#c0392b"]],
            labels={"personnel_needed": "Officers Needed", "police_station": ""},
        )
        fig_workload.update_layout(
            showlegend=False, coloraxis_showscale=False,
            plot_bgcolor="white", height=500,
            margin=dict(t=20, b=20, l=10, r=20),
        )
        st.plotly_chart(fig_workload, use_container_width=True)

        # Download
        csv_sched = display_sched.to_csv(index=False).encode("utf-8")
        st.download_button(
            "📥 Download Patrol Plan (CSV)",
            csv_sched,
            "patrol_plan.csv",
            "text/csv",
        )

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 8: MapmyIndia View ──────────────────────────────────────────────────
elif page == "MapmyIndia View":
    st.header("MapmyIndia View")

    api_key = os.getenv("MAPMYINDIA_API_KEY", "")
    if not api_key or api_key == "your_key_here":
        st.info("Add MAPMYINDIA_API_KEY to .env to enable this view.")
    else:
        if fcs.empty:
            st.info("No records found for selected filters.")
        else:
            # Impact filter for the map
            map_impact_filter = st.multiselect(
                "Show impact levels",
                ["CRITICAL", "HIGH", "MODERATE", "LOW"],
                default=["CRITICAL", "HIGH", "MODERATE"],
            )
            top30 = fcs[fcs["impact_category"].isin(map_impact_filter)].head(30)
            hotspot_json = top30[[
                "cluster_id", "lat", "lon", "congestion_score",
                "violation_count", "top_violation", "top_police_station",
                "impact_category", "parking_category", "estimated_delay_minutes",
                "carriageway_blockage_pct", "location_type", "junction_label", "trend"
            ]].to_dict(orient="records")

            template_path = os.path.join("components", "mapmyindia_map.html")
            with open(template_path, "r", encoding="utf-8") as f:
                html = f.read()

            html = html.replace("{API_KEY}", api_key)
            html = html.replace("__HOTSPOT_DATA__", json.dumps(hotspot_json))
            components.html(html, height=600)

    st.markdown(FOOTER, unsafe_allow_html=True)
