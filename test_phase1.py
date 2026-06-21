import sys

print('Testing Phase 1 modules...')

from modules.data_loader import load_violations
from modules.violation_decoder import decode_violations
from modules.clustering import find_hotspots
from modules.scoring import score_clusters
from modules.trend_engine import compute_weekly_trends, get_trending_zones
from modules.patrol_scheduler import generate_patrol_schedule, schedule_summary

print('[1/5] Loading data...')
df = load_violations('data/violations.csv')
print(f'  Loaded {len(df):,} rows')
print(f'  New cols: location_type, junction_id, year_week present:', all(c in df.columns for c in ['location_type','junction_id','year_week']))

print('[2/5] Decoding violations...')
df = decode_violations(df)
print('  parking_category:', df['parking_category'].value_counts().to_dict())
print('  is_parking_violation count:', df['is_parking_violation'].sum())

print('[3/5] Clustering...')
df = find_hotspots(df)
n_clusters = df['cluster'].nunique() - 1
print(f'  Clusters found: {n_clusters}')

print('[4/5] Scoring...')
cluster_stats = score_clusters(df)
print(f'  cluster_stats shape: {cluster_stats.shape}')
if not cluster_stats.empty:
    top = cluster_stats.iloc[0]
    print(f'  Top zone delay={top["estimated_delay_minutes"]}min, impact={top["impact_category"]}, location={top["location_type"]}')
    print('  impact_category counts:', cluster_stats['impact_category'].value_counts().to_dict())

print('[5/5] Trend + Patrol...')
trends = compute_weekly_trends(df)
print(f'  Overall weeks: {len(trends["overall"])}')
cluster_stats = get_trending_zones(cluster_stats, trends['cluster_trend'])
print('  trend col added:', 'trend' in cluster_stats.columns)
schedule = generate_patrol_schedule(cluster_stats)
summary = schedule_summary(schedule)
print(f'  Schedule rows: {len(schedule)}')
print(f'  Summary: {summary}')

print()
print('ALL PHASE 1 TESTS PASSED')
