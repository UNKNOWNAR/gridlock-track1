import os
import json
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
footer { visibility: hidden; }
</style>""", unsafe_allow_html=True)

FOOTER = "<p style='color:#aaa;font-size:11px;margin-top:40px'>BTP × Flipkart Gridlock 2.0 | Data: Jan–May 2024 | Built for operational use</p>"


@st.cache_data
def get_data():
    df = load_violations("data/violations.csv")
    df = decode_violations(df)
    df = find_hotspots(df)
    cluster_stats = score_clusters(df)
    return df, cluster_stats


df, cluster_stats = get_data()

with st.sidebar:
    st.markdown("<p style='color:#7f8c8d;font-size:12px;margin-bottom:0'>BTP × Gridlock 2.0</p>", unsafe_allow_html=True)
    st.markdown("---")
    min_date = df["created_datetime"].min()
    max_date = df["created_datetime"].max()
    if pd.notna(min_date) and pd.notna(max_date):
        st.markdown(f"**Date range:** {min_date.strftime('%d %b %Y')} — {max_date.strftime('%d %b %Y')}")
    st.markdown(f"**Total records:** {len(df):,}")
    approved_count = (df["validation_status"] == "approved").sum()
    rejected_count = (df["validation_status"] == "rejected").sum()
    st.markdown(f"**Approved:** {approved_count:,}")
    st.markdown(f"**Rejected:** {rejected_count:,}")
    st.markdown("---")
    page = st.radio(
        "Navigation",
        ["Zone Intelligence", "Risk Scoring", "Shift Deployment",
         "Station Analysis", "MapmyIndia View"],
        label_visibility="collapsed",
    )


# ─── PAGE 1: Zone Intelligence ───────────────────────────────────────────────

if page == "Zone Intelligence":
    st.header("Zone Intelligence")

    gap_count = int(cluster_stats["enforcement_gap_flag"].sum()) if not cluster_stats.empty else 0
    top_zone = cluster_stats.iloc[0] if not cluster_stats.empty else None

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Cases", f"{len(df):,}")
    c2.metric("Hotspot Zones", f"{len(cluster_stats)}")
    c3.metric("Highest Risk Zone",
              f"{top_zone['lat']:.4f}, {top_zone['lon']:.4f}" if top_zone is not None else "N/A")
    c4.metric("Enforcement Gaps", f"{gap_count}")

    m = folium.Map(location=[12.9716, 77.5946], zoom_start=12, tiles="cartodbpositron")

    approved_df = df[(df["validation_status"] == "approved") & df["latitude"].notna() & df["longitude"].notna()]
    if not approved_df.empty and not cluster_stats.empty:
        score_map = dict(zip(
            zip(cluster_stats["lat"].round(4), cluster_stats["lon"].round(4)),
            cluster_stats["congestion_score"],
        ))
        heat_data = []
        for _, row in approved_df.iterrows():
            weight = 1.0
            if row["cluster"] != -1 and not cluster_stats.empty:
                match = cluster_stats[cluster_stats["cluster_id"] == row["cluster"]]
                if not match.empty:
                    weight = match.iloc[0]["congestion_score"]
            heat_data.append([row["latitude"], row["longitude"], weight])
        HeatMap(heat_data, radius=15, blur=10, max_zoom=13).add_to(m)

    top15 = cluster_stats.head(15) if not cluster_stats.empty else pd.DataFrame()
    for _, cl in top15.iterrows():
        color = "#c0392b" if cl["enforcement_gap_flag"] else "#e67e22"
        radius = max(5, min(cl["congestion_score"] / 20, 30))
        popup_text = (
            f"Zone {cl['cluster_id']} | {cl['top_violation']} | "
            f"Cases: {cl['violation_count']} | Risk Score: {cl['congestion_score']:.1f} | "
            f"Recommended: Deploy 2 personnel"
        )
        folium.CircleMarker(
            location=[cl["lat"], cl["lon"]],
            radius=radius,
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.7,
            popup=folium.Popup(popup_text, max_width=300),
        ).add_to(m)

    components.html(m._repr_html_(), height=500)

    with st.expander("Enforcement Gap Analysis"):
        gap_zones = cluster_stats[cluster_stats["enforcement_gap_flag"]] if not cluster_stats.empty else pd.DataFrame()
        if len(gap_zones) > 0:
            st.markdown(
                f"<span style='color:#c0392b'>⚠ {len(gap_zones)} zones show approval rate below 60% — likely under-patrolled</span>",
                unsafe_allow_html=True,
            )
            display_gaps = gap_zones[["cluster_id", "violation_count", "approval_rate", "top_violation", "top_police_station"]].copy()
            display_gaps.columns = ["Zone", "Cases", "Approval Rate", "Primary Offence", "Nearest Station"]
            st.dataframe(display_gaps, use_container_width=True, hide_index=True)

            gap_map = folium.Map(location=[12.9716, 77.5946], zoom_start=12, tiles="cartodbpositron")
            for _, gz in gap_zones.iterrows():
                folium.Marker(
                    location=[gz["lat"], gz["lon"]],
                    icon=folium.Icon(color="red", icon="exclamation-sign"),
                    popup=f"Zone {gz['cluster_id']} — Approval: {gz['approval_rate']:.0%}",
                ).add_to(gap_map)
            components.html(gap_map._repr_html_(), height=350)
        else:
            st.info("No enforcement gaps detected.")

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 2: Risk Scoring ────────────────────────────────────────────────────

elif page == "Risk Scoring":
    st.header("Risk Scoring")

    if cluster_stats.empty:
        st.info("No records found for selected filters.")
    else:
        top20 = cluster_stats.head(20).copy()
        top20["zone_label"] = top20.apply(
            lambda r: f"Zone {r['cluster_id']}", axis=1
        )

        fig_bar = px.bar(
            top20,
            x="zone_label",
            y="congestion_score",
            color="congestion_score",
            color_continuous_scale=[[0, "#7f8c8d"], [1, "#c0392b"]],
            labels={"congestion_score": "Risk Score", "zone_label": "Zone"},
        )
        fig_bar.update_layout(
            showlegend=False,
            coloraxis_showscale=False,
            plot_bgcolor="white",
        )
        st.plotly_chart(fig_bar, use_container_width=True)

        fig_scatter = px.scatter_mapbox(
            cluster_stats,
            lat="lat",
            lon="lon",
            size="congestion_score",
            color="enforcement_gap_flag",
            color_discrete_map={True: "#c0392b", False: "#7f8c8d"},
            hover_data=["cluster_id", "violation_count", "top_violation"],
            zoom=11,
            mapbox_style="open-street-map",
        )
        fig_scatter.update_layout(margin=dict(l=0, r=0, t=0, b=0), height=450)
        st.plotly_chart(fig_scatter, use_container_width=True)

        display_df = cluster_stats[[
            "cluster_id", "congestion_score", "violation_count",
            "approval_rate", "enforcement_gap_flag", "top_violation", "peak_hour",
        ]].copy()
        st.dataframe(
            display_df,
            column_config={
                "cluster_id": "Zone",
                "congestion_score": "Risk Score",
                "violation_count": "Cases",
                "approval_rate": "Approval Rate",
                "enforcement_gap_flag": "Gap Flagged",
                "top_violation": "Primary Offence",
                "peak_hour": "Peak Hour",
            },
            use_container_width=True,
            hide_index=True,
        )

        csv_data = cluster_stats.to_csv(index=False).encode("utf-8")
        st.download_button(
            "Download enforcement_zones.csv",
            csv_data,
            "enforcement_zones.csv",
            "text/csv",
        )

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 3: Shift Deployment ────────────────────────────────────────────────

elif page == "Shift Deployment":
    st.header("Shift Deployment")

    shifts = {
        "Morning (06–10)": (6, 10),
        "Afternoon (12–16)": (12, 16),
        "Evening (17–21)": (17, 21),
    }

    cols = st.columns(3)
    for col, (shift_name, (h_start, h_end)) in zip(cols, shifts.items()):
        with col:
            st.subheader(shift_name)
            shift_df = df[df["hour"].between(h_start, h_end)]
            if shift_df.empty or cluster_stats.empty:
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
                match = cluster_stats[cluster_stats["cluster_id"] == cid]
                if match.empty:
                    continue
                info = match.iloc[0]
                st.markdown(
                    f"**{rank}.** {info['top_violation']} — "
                    f"{info['lat']:.4f}, {info['lon']:.4f} — {sc['count']} cases"
                )

            vtype_counts = shift_df["primary_violation"].value_counts().head(8)
            fig = px.bar(
                x=vtype_counts.index,
                y=vtype_counts.values,
                labels={"x": "Violation Type", "y": "Count"},
                color_discrete_sequence=["#7f8c8d"],
            )
            fig.update_layout(
                showlegend=False,
                plot_bgcolor="white",
                height=250,
                margin=dict(l=0, r=0, t=10, b=0),
            )
            st.plotly_chart(fig, use_container_width=True)

            gap_in_shift = shift_clustered.merge(
                cluster_stats[cluster_stats["enforcement_gap_flag"]][["cluster_id"]],
                left_on="cluster",
                right_on="cluster_id",
                how="inner",
            )
            if not gap_in_shift.empty:
                st.markdown(
                    "<span style='color:#c0392b;font-weight:bold'>"
                    "⚠ Gap zone active during this shift</span>",
                    unsafe_allow_html=True,
                )

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 4: Station Analysis ────────────────────────────────────────────────

elif page == "Station Analysis":
    st.header("Station Analysis")

    stations = sorted(df["police_station"].dropna().unique())
    if not stations:
        st.info("No records found for selected filters.")
    else:
        selected = st.selectbox("Select Police Station", stations)
        sdf = df[df["police_station"] == selected]

        if sdf.empty:
            st.info("No records found for selected filters.")
        else:
            total_cases = len(sdf)
            station_approved = (sdf["validation_status"] == "approved").sum()
            station_approval_rate = station_approved / total_cases if total_cases > 0 else 0
            avg_res = sdf["resolution_hours"].dropna().mean()

            c1, c2, c3 = st.columns(3)
            c1.metric("Total Cases", f"{total_cases:,}")
            c2.metric("Approval Rate", f"{station_approval_rate:.1%}")
            c3.metric("Avg Resolution (hrs)", f"{avg_res:.1f}" if pd.notna(avg_res) else "N/A")

            if station_approval_rate < 0.6:
                st.markdown(
                    "<span style='color:#c0392b'>⚠ Low approval rate — review enforcement quality</span>",
                    unsafe_allow_html=True,
                )

            monthly = sdf.groupby("month").size().reset_index(name="count")
            fig_month = px.bar(
                monthly,
                x="month",
                y="count",
                labels={"month": "Month", "count": "Violations"},
                color_discrete_sequence=["#7f8c8d"],
            )
            fig_month.update_layout(plot_bgcolor="white")
            st.plotly_chart(fig_month, use_container_width=True)

            vtype = sdf["vehicle_type"].value_counts().head(8)
            grey_palette = ["#2c3e50", "#7f8c8d", "#95a5a6", "#bdc3c7", "#d5dbdb", "#aab7b8", "#5d6d7e", "#85929e"]
            fig_pie = px.pie(
                names=vtype.index,
                values=vtype.values,
                color_discrete_sequence=grey_palette,
            )
            fig_pie.update_layout(height=350)
            st.plotly_chart(fig_pie, use_container_width=True)

            st.markdown("**Top 3 violations:**")
            top_v = sdf["primary_violation"].value_counts().head(3)
            for vname, vcount in top_v.items():
                st.markdown(f"- {vname}: {vcount:,} cases")

            junction_counts = (
                sdf.groupby("junction_name")
                .size()
                .reset_index(name="Cases")
                .sort_values("Cases", ascending=False)
            )
            junction_counts.columns = ["Junction", "Cases"]
            st.dataframe(junction_counts, use_container_width=True, hide_index=True)

    st.markdown(FOOTER, unsafe_allow_html=True)


# ─── PAGE 5: MapmyIndia View ─────────────────────────────────────────────────

elif page == "MapmyIndia View":
    st.header("MapmyIndia View")

    api_key = os.getenv("MAPMYINDIA_API_KEY", "")
    if not api_key or api_key == "your_key_here":
        st.info("Add MAPMYINDIA_API_KEY to .env to enable this view.")
    else:
        if cluster_stats.empty:
            st.info("No records found for selected filters.")
        else:
            top20 = cluster_stats.head(20)
            hotspot_json = top20[
                ["cluster_id", "lat", "lon", "congestion_score",
                 "violation_count", "top_violation", "top_police_station"]
            ].to_dict(orient="records")

            template_path = os.path.join("components", "mapmyindia_map.html")
            with open(template_path, "r", encoding="utf-8") as f:
                html = f.read()

            html = html.replace("{API_KEY}", api_key)
            html = html.replace("__HOTSPOT_DATA__", json.dumps(hotspot_json))
            components.html(html, height=550)

    st.markdown(FOOTER, unsafe_allow_html=True)
