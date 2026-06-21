import React, { useState, useEffect } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  CircleMarker, 
  Popup,
  useMap
} from 'react-leaflet';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { 
  Map as MapIcon, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  ShieldAlert, 
  Download, 
  Activity, 
  Calendar, 
  Users, 
  BarChart2, 
  Info,
  ChevronRight,
  Navigation,
  Car,
  Flame,
  Shield,
  Target,
  Zap,
} from 'lucide-react';

// Use relative URL so Vite proxy forwards to FastAPI on port 8000
const API_BASE = "/api";

const IMPACT_COLORS = {
  CRITICAL: "#c0392b",
  HIGH: "#e67e22",
  MODERATE: "#f39c12",
  LOW: "#27ae60",
};

const SEVERITY_PALETTE = ["#c0392b", "#e67e22", "#f39c12", "#3498db", "#8e44ad", "#16a085"];
const LOC_COLORS = {
  "Metro Station": "#8e44ad",
  "Commercial": "#2980b9",
  "Main Road": "#c0392b",
  "Hospital School": "#16a085",
  "Residential": "#7f8c8d",
  "Unknown": "#bdc3c7",
};

// Helper component to center map on coordinates
function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

// Custom map controller to handle centering, zooming, and opening popups dynamically
function MapController({ selectedZoneId, hotspots }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedZoneId && hotspots && hotspots.length > 0) {
      const zone = hotspots.find(h => h.cluster_id === selectedZoneId);
      if (zone) {
        map.flyTo([zone.lat, zone.lon], 15, {
          animate: true,
          duration: 1.5
        });
        
        // Wait for flyTo animation, then open popup
        const timer = setTimeout(() => {
          map.openPopup(
            `
            <div style="min-width: 200px; font-family: sans-serif; color: #333; line-height: 1.4;">
              <h4 style="margin: 0 0 6px; font-weight: 700; font-size: 14px; color: #111;">Zone ${zone.cluster_id} — ${zone.junction_label || 'No Junction'}</h4>
              <p style="margin: 2px 0; font-size: 12px;"><strong>Impact:</strong> ${zone.impact_category || 'N/A'}</p>
              <p style="margin: 2px 0; font-size: 12px;"><strong>Severity:</strong> ${zone.parking_category || 'N/A'}</p>
              <p style="margin: 2px 0; font-size: 12px;"><strong>Cases:</strong> ${zone.violation_count || 0}</p>
              <p style="margin: 2px 0; font-size: 12px;"><strong>Est. Delay:</strong> ${zone.estimated_delay_minutes?.toFixed(0) || 0} min</p>
              <p style="margin: 2px 0; font-size: 12px;"><strong>Road Blocked:</strong> ${zone.carriageway_blockage_pct?.toFixed(1) || 0}%</p>
              <p style="margin: 2px 0; font-size: 12px;"><strong>Station:</strong> ${zone.top_police_station || 'N/A'}</p>
              <p style="margin: 2px 0; font-size: 12px;"><strong>Trend:</strong> ${zone.trend || 'N/A'}</p>
              ${zone.enforcement_gap_flag ? '<p style="color: #c0392b; font-weight: bold; margin-top: 6px; font-size: 12px;">⚠️ UNDER-ENFORCED ZONE</p>' : ''}
            </div>
            `,
            [zone.lat, zone.lon]
          );
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedZoneId, hotspots, map]);

  return null;
}

// Custom Apple Fitness style SVG Activity Rings for Precinct Analysis
function PrecinctActivityRings({ approvalRate = 0.75, resolutionCompliance = 0.65, activityRate = 0.85 }) {
  const [hoveredRing, setHoveredRing] = useState(null);
  const size = 180;
  const strokeWidth = 14;
  const center = size / 2;
  const rings = [
    { id: "approval", label: "Approval Rate", value: approvalRate, color: "var(--system-teal)", radius: 70, circumference: 2 * Math.PI * 70 },
    { id: "resolution", label: "Resolution compliance", value: resolutionCompliance, color: "var(--system-indigo)", radius: 52, circumference: 2 * Math.PI * 52 },
    { id: "activity", label: "Patrol Compliance", value: activityRate, color: "var(--system-orange)", radius: 34, circumference: 2 * Math.PI * 34 }
  ];
  const getDisplayValue = () => {
    if (hoveredRing) {
      const match = rings.find(r => r.id === hoveredRing);
      return { percent: `${(match.value * 100).toFixed(0)}%`, label: match.label };
    }
    return { percent: `${(approvalRate * 100).toFixed(0)}%`, label: "Avg Approval" };
  };
  const display = getDisplayValue();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.5rem 0', gap: '1rem', width: '100%' }}>
      <div className="activity-ring-container" style={{ width: size, height: size, flexShrink: 0 }}>
        <svg className="activity-ring" width={size} height={size}>
          {rings.map((ring) => {
            const offset = ring.circumference - (ring.value * ring.circumference);
            return (
              <g key={ring.id} onMouseEnter={() => setHoveredRing(ring.id)} onMouseLeave={() => setHoveredRing(null)} style={{ cursor: 'pointer' }}>
                <circle className="activity-ring-bg" cx={center} cy={center} r={ring.radius} strokeWidth={strokeWidth} />
                <circle className="activity-ring-progress" cx={center} cy={center} r={ring.radius} strokeWidth={strokeWidth} stroke={ring.color}
                  strokeDasharray={ring.circumference} strokeDashoffset={offset}
                  style={{ transformOrigin: '50% 50%', filter: hoveredRing === ring.id ? `drop-shadow(0 0 6px ${ring.color})` : 'none', opacity: hoveredRing && hoveredRing !== ring.id ? 0.3 : 1, transition: 'all 0.3s ease' }}
                />
              </g>
            );
          })}
        </svg>
        <div className="activity-ring-label" style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>{display.percent}</span>
          <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginTop: '2px', textAlign: 'center', maxWidth: '80px', lineHeight: '1.2' }}>{display.label}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem', flexGrow: 1 }}>
        {rings.map(ring => (
          <div key={ring.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', opacity: hoveredRing && hoveredRing !== ring.id ? 0.4 : 1, transition: 'opacity 0.2s ease', padding: '0.25rem 0.5rem', borderRadius: '8px', backgroundColor: hoveredRing === ring.id ? 'rgba(255,255,255,0.03)' : 'transparent' }}
            onMouseEnter={() => setHoveredRing(ring.id)} onMouseLeave={() => setHoveredRing(null)}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: ring.color, flexShrink: 0 }}></span>
            <span style={{ color: 'var(--text-secondary)' }}>{ring.label}: <strong style={{ color: 'var(--text-primary)' }}>{(ring.value * 100).toFixed(0)}%</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// BTP Flowchart pipeline component
function PipelineFlowchart() {
  const steps = [
    { id: 1, title: "Data Feed Ingest", desc: "Violations logs & CSV upload", icon: Download, color: "var(--system-blue)" },
    { id: 2, title: "DBSCAN Clustering", desc: "Spatial grouping (ε=150m)", icon: Activity, color: "var(--system-teal)" },
    { id: 3, title: "Risk Priority Scoring", desc: "Weighting congestion impact", icon: AlertTriangle, color: "var(--system-orange)" },
    { id: 4, title: "Enforcement Audit", desc: "Flagging gap zones (<60%)", icon: ShieldAlert, color: "var(--system-red)" },
    { id: 5, title: "Shift Officer Dispatch", desc: "Optimized patrol scheduling", icon: Navigation, color: "var(--system-indigo)" }
  ];
  return (
    <div className="card card-animate delay-3" style={{ width: '100%' }}>
      <div className="card-header" style={{ marginBottom: '1rem' }}>
        <h3 className="card-title"><Activity size={16} style={{ color: 'var(--system-blue)' }} /> BTP Intelligent Enforcement Pipeline</h3>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
        End-to-end data processing workflow. AI models automatically compile spatial coordinate streams, clusters offences, grades congestion levels, and assigns officers.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflowX: 'auto', padding: '0.5rem 0' }}>
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.id}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, minWidth: '120px', flex: 1 }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: `1px solid rgba(255, 255, 255, 0.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: step.color, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'all 0.3s ease', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.borderColor = step.color; e.currentTarget.style.transform = 'scale(1.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.transform = 'scale(1)'; }}>
                    <Icon size={18} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.65rem', textAlign: 'center' }}>{step.title}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem', textAlign: 'center', maxWidth: '105px', lineHeight: '1.2' }}>{step.desc}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div style={{ flexGrow: 1, height: '4px', display: 'flex', alignItems: 'center', margin: '0 -15px', zIndex: 1, minWidth: '35px' }}>
                    <svg width="100%" height="4" style={{ overflow: 'visible' }}>
                      <line x1="0%" y1="2" x2="100%" y2="2" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="2" />
                      <line x1="0%" y1="2" x2="100%" y2="2" stroke={step.color} strokeWidth="2" className="pipeline-flow-line" style={{ opacity: 0.8 }} />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Impact badge pill
function ImpactBadge({ impact }) {
  const color = IMPACT_COLORS[impact] || '#7f8c8d';
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '20px', backgroundColor: `${color}22`, border: `1px solid ${color}`, color, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>
      {impact}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("Zone Intelligence");
  const [stats, setStats] = useState({ total_cases: 0, approved: 0, rejected: 0, avg_approval_rate: 0, hotspots_count: 0, enforcement_gaps: 0, critical_zones: 0, total_delay_hours: 0, unique_junctions: 0, highest_risk_zone: null });
  const [hotspots, setHotspots] = useState([]);
  const [violations, setViolations] = useState([]);
  const [shifts, setShifts] = useState({});
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [stationData, setStationData] = useState(null);
  const [parkingData, setParkingData] = useState(null);
  const [congestionData, setCongestionData] = useState(null);
  const [patrolData, setPatrolData] = useState(null);
  const [patrolShiftFilter, setPatrolShiftFilter] = useState("All Shifts");
  const [loading, setLoading] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState(null);

  const handleZoneClick = (zoneId) => {
    setSelectedZoneId(zoneId);
    setActiveTab("Zone Intelligence");
  };

  useEffect(() => {
    async function fetchGlobalData() {
      try {
        setLoading(true);
        const [statsRes, hotspotsRes, violationsRes, shiftsRes, stationsRes] = await Promise.all([
          fetch(`${API_BASE}/stats`),
          fetch(`${API_BASE}/hotspots`),
          fetch(`${API_BASE}/violations`),
          fetch(`${API_BASE}/shifts`),
          fetch(`${API_BASE}/stations`),
        ]);
        setStats(await statsRes.json());
        setHotspots(await hotspotsRes.json());
        setViolations(await violationsRes.json());
        setShifts(await shiftsRes.json());
        const stList = await stationsRes.json();
        setStations(stList);
        if (stList.length > 0) setSelectedStation(stList[0]);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGlobalData();
  }, []);

  // Lazy-load page-specific data
  useEffect(() => {
    if (activeTab === "Parking Intelligence" && !parkingData) {
      fetch(`${API_BASE}/parking`).then(r => r.json()).then(setParkingData);
    }
    if (activeTab === "Congestion Impact" && !congestionData) {
      fetch(`${API_BASE}/congestion`).then(r => r.json()).then(setCongestionData);
    }
    if (activeTab === "Patrol Planner" && !patrolData) {
      fetch(`${API_BASE}/patrol`).then(r => r.json()).then(setPatrolData);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!selectedStation) return;
    fetch(`${API_BASE}/station/${encodeURIComponent(selectedStation)}`).then(r => r.json()).then(setStationData);
  }, [selectedStation]);

  const downloadCSV = () => {
    if (hotspots.length === 0) return;
    const headers = ["Zone ID", "Impact", "Severity", "Cases", "Est. Delay (min)", "Road Blockage %", "Approval Rate", "Gap Flagged", "Primary Offence", "Peak Hour", "Nearest Station", "Latitude", "Longitude"];
    const rows = hotspots.map(h => [h.cluster_id, h.impact_category, h.parking_category, h.violation_count, h.estimated_delay_minutes?.toFixed(0), h.carriageway_blockage_pct?.toFixed(1), h.approval_rate, h.enforcement_gap_flag ? "TRUE" : "FALSE", h.top_violation, h.peak_hour, h.top_police_station, h.lat, h.lon]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `enforcement_zones_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const getViolationColor = (type) => {
    switch (type) {
      case "No Parking": return "var(--system-orange)";
      case "Wrong Side": return "var(--system-red)";
      case "Obstruction": return "var(--system-blue)";
      default: return "var(--system-teal)";
    }
  };

  const NAV_ITEMS = [
    { id: "Zone Intelligence", icon: MapIcon },
    { id: "Parking Intelligence", icon: Car },
    { id: "Congestion Impact", icon: Flame },
    { id: "Patrol Planner", icon: Shield },
    { id: "Risk Scoring", icon: BarChart2 },
    { id: "Shift Deployment", icon: Clock },
    { id: "Station Analysis", icon: ShieldAlert },
    { id: "MapmyIndia View", icon: Navigation },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#07090e', color: '#06b6d4', fontSize: '1.5rem', fontWeight: 600 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Activity size={48} className="animate-pulse" />
          <span>BTP Enforcement Intelligence Loading...</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Processing 298,450 violation records...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="glow-bg-container">
        <div className="glow-blob blob-blue"></div>
        <div className="glow-blob blob-indigo"></div>
        <div className="glow-blob blob-teal"></div>
      </div>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <span className="logo-title">BTP ENFORCEMENT</span>
          <span className="logo-subtitle">GRIDLOCK TRACK-1</span>
        </div>
        <div className="divider"></div>
        <ul className="nav-list">
          {NAV_ITEMS.map(tab => {
            const Icon = tab.icon;
            return (
              <li key={tab.id} className={`nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <Icon size={18} />{tab.id}
              </li>
            );
          })}
        </ul>
        <div className="sidebar-footer">
          <p>BTP × Gridlock 2.0</p>
          <p>Data: Nov 2023–Apr 2024</p>
          <p style={{ marginTop: '4px' }}>Operational dashboard built for Bangalore traffic enforcement prioritization</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">{activeTab}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Real-time spatial clustering and congestion forecasting dashboard
            </p>
          </div>
          {activeTab === "Risk Scoring" && (
            <button className="btn-download" onClick={downloadCSV}><Download size={16} />Export Zone Details</button>
          )}
          {activeTab === "Congestion Impact" && congestionData && (
            <button className="btn-download" onClick={() => {
              const data = JSON.stringify(congestionData, null, 2);
              const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
              const a = document.createElement('a'); a.href = url; a.download = 'congestion_report.json'; a.click();
            }}><Download size={16} />Export Report</button>
          )}
        </div>

        <div key={activeTab} className="tab-transition-container">
          {/* Global metrics ribbon */}
          {!["Station Analysis"].includes(activeTab) && (
            <section className="metrics-grid">
              <div className="card metric-card card-animate delay-1">
                <span className="metric-label">Total Parking Cases</span>
                <span className="metric-value">{stats.total_cases.toLocaleString()}</span>
                <span className="metric-subtext">Nov 2023 – Apr 2024</span>
              </div>
              <div className="card metric-card card-animate delay-1">
                <span className="metric-label">Hotspot Clusters</span>
                <span className="metric-value">{stats.hotspots_count}</span>
                <span className="metric-subtext">DBSCAN (ε=150m, Min=5)</span>
              </div>
              <div className="card metric-card card-animate delay-1">
                <span className="metric-label">Total Delay Generated</span>
                <span className="metric-value" style={{ color: 'var(--system-red)' }}>{stats.total_delay_hours?.toLocaleString()} hrs</span>
                <span className="metric-subtext">Estimated vehicle-hours lost</span>
              </div>
              <div className="card metric-card card-animate delay-1">
                <span className="metric-label">Critical Zones</span>
                <span className="metric-value" style={{ color: stats.critical_zones > 0 ? 'var(--system-red)' : 'var(--text-primary)' }}>
                  {stats.critical_zones}
                </span>
                <span className="metric-subtext">Carriageway blockage {">"} 500 min</span>
              </div>
            </section>
          )}

          {/* ─── TAB 1: ZONE INTELLIGENCE ───────────────────────────────── */}
          {activeTab === "Zone Intelligence" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="dashboard-grid-main">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="card card-animate delay-2" style={{ padding: '1rem' }}>
                    <div className="card-header" style={{ marginBottom: '0.75rem' }}>
                      <h3 className="card-title"><MapIcon size={16} style={{ color: 'var(--system-blue)' }} /> Geographic Violation Heatmap</h3>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                        {[{ color: 'var(--system-red)', label: 'Critical' }, { color: 'var(--system-orange)', label: 'High' }, { color: 'var(--system-teal)', label: 'Low' }].map(l => (
                          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: l.color }}></span> {l.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="map-container">
                      <MapContainer center={[12.96, 77.61]} zoom={12} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                        <TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                        <MapController selectedZoneId={selectedZoneId} hotspots={hotspots} />
                        {violations.map((v, idx) => (
                          <CircleMarker key={`v-${idx}`} center={[v.lat, v.lon]} radius={2}
                            pathOptions={{ color: 'rgba(10, 132, 255, 0.15)', fillColor: 'var(--system-blue)', fillOpacity: 0.25, weight: 0 }} />
                        ))}
                        {hotspots.map((h) => {
                          const radius = Math.max(8, Math.min(h.congestion_score * 0.4, 25));
                          const color = IMPACT_COLORS[h.impact_category] || 'var(--system-orange)';
                          return (
                            <CircleMarker key={`h-${h.cluster_id}`} center={[h.lat, h.lon]} radius={radius}
                              pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 1.5, dashArray: h.enforcement_gap_flag ? '4' : null }}>
                              <Popup>
                                <div style={{ minWidth: '200px' }}>
                                  <h4 style={{ margin: '0 0 4px' }}>Zone {h.cluster_id} — {h.junction_label}</h4>
                                  <p><strong>Impact:</strong> {h.impact_category}</p>
                                  <p><strong>Severity:</strong> {h.parking_category}</p>
                                  <p><strong>Cases:</strong> {h.violation_count}</p>
                                  <p><strong>Est. Delay:</strong> {h.estimated_delay_minutes?.toFixed(0)} min</p>
                                  <p><strong>Road Blocked:</strong> {h.carriageway_blockage_pct?.toFixed(1)}%</p>
                                  <p><strong>Station:</strong> {h.top_police_station}</p>
                                  <p><strong>Trend:</strong> {h.trend}</p>
                                  {h.enforcement_gap_flag && <p style={{ color: '#c0392b', fontWeight: 'bold', marginTop: '4px' }}>⚠️ UNDER-ENFORCED ZONE</p>}
                                </div>
                              </Popup>
                            </CircleMarker>
                          );
                        })}
                      </MapContainer>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="card card-animate delay-2" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <div className="card-header">
                      <h3 className="card-title"><ShieldAlert size={16} style={{ color: 'var(--system-red)' }} /> Gap Alert Watchlist</h3>
                      <span className="badge badge-red">{stats.enforcement_gaps} Flagged</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>Zones with approval rates &lt;60%. Requires patrolling officer audit.</p>
                    <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table>
                        <thead><tr><th>Zone</th><th>Impact</th><th>Cases</th><th>Approval</th><th>Station</th></tr></thead>
                        <tbody>
                          {hotspots.filter(h => h.enforcement_gap_flag).map(h => (
                            <tr key={h.cluster_id}>
                              <td>
                                <span 
                                  onClick={() => handleZoneClick(h.cluster_id)}
                                  style={{ color: 'var(--system-blue)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                                  title="View on Map"
                                >
                                  #{h.cluster_id}
                                </span>
                              </td>
                              <td><ImpactBadge impact={h.impact_category} /></td>
                              <td>{h.violation_count}</td>
                              <td><span style={{ color: 'var(--system-red)', fontWeight: 600 }}>{(h.approval_rate * 100).toFixed(0)}%</span></td>
                              <td>{h.top_police_station}</td>
                            </tr>
                          ))}
                          {hotspots.filter(h => h.enforcement_gap_flag).length === 0 && (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No enforcement gaps currently flagged!</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              <PipelineFlowchart />
            </div>
          )}

          {/* ─── TAB 2: PARKING INTELLIGENCE ────────────────────────────── */}
          {activeTab === "Parking Intelligence" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {!parkingData ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}><Activity size={32} className="animate-pulse" /><p>Loading parking intelligence...</p></div>
              ) : (
                <>
                  {/* Location type KPIs */}
                  <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                    {[
                      { key: 'metro_station', label: 'Metro Area', icon: '🚇', color: '#8e44ad' },
                      { key: 'commercial', label: 'Commercial', icon: '🏪', color: '#2980b9' },
                      { key: 'main_road', label: 'Main Road', icon: '🛣️', color: '#c0392b' },
                      { key: 'hospital_school', label: 'Hospital/School', icon: '🏥', color: '#16a085' },
                      { key: 'residential', label: 'Residential', icon: '🏘️', color: '#7f8c8d' },
                    ].map(loc => (
                      <div key={loc.key} className="card metric-card card-animate delay-1" style={{ borderLeft: `3px solid ${loc.color}` }}>
                        <span className="metric-label">{loc.icon} {loc.label}</span>
                        <span className="metric-value" style={{ color: loc.color }}>{(parkingData.location_counts[loc.key] || 0).toLocaleString()}</span>
                        <span className="metric-subtext">violations</span>
                      </div>
                    ))}
                  </section>

                  <div className="dashboard-grid-main">
                    {/* Severity donut */}
                    <div className="card card-animate delay-2">
                      <div className="card-header"><h3 className="card-title"><AlertTriangle size={16} style={{ color: 'var(--system-orange)' }} /> Violation Severity Distribution</h3></div>
                      <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={Object.entries(parkingData.severity_counts).map(([k, v]) => ({ name: k, value: v }))}
                              cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                              {Object.keys(parkingData.severity_counts).map((k, i) => (
                                <Cell key={k} fill={['#c0392b', '#e67e22', '#f39c12', '#7f8c8d'][i % 4]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Sub-type horizontal bar */}
                    <div className="card card-animate delay-2">
                      <div className="card-header"><h3 className="card-title"><BarChart2 size={16} style={{ color: 'var(--system-blue)' }} /> Violation Sub-Types</h3></div>
                      <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={Object.entries(parkingData.sub_type_counts).map(([k, v]) => ({ name: k.replace('PARKING ', '').replace('WRONG ', 'WRONG '), count: v })).slice(0, 10)} layout="vertical">
                            <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                            <XAxis type="number" stroke="var(--text-secondary)" style={{ fontSize: '0.7rem' }} />
                            <YAxis type="category" dataKey="name" width={160} stroke="var(--text-secondary)" style={{ fontSize: '0.65rem' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                              {Object.keys(parkingData.sub_type_counts).slice(0, 10).map((_, i) => (
                                <Cell key={i} fill={`hsl(${10 + i * 12}, 80%, ${55 - i * 2}%)`} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Top hotspots table */}
                  <div className="card card-animate delay-3">
                    <div className="card-header"><h3 className="card-title"><Target size={16} style={{ color: 'var(--system-red)' }} /> Top Parking Hotspots by Impact</h3></div>
                    <div className="table-wrapper">
                      <table>
                        <thead><tr><th>Zone</th><th>Junction</th><th>Station</th><th>Location</th><th>Cases</th><th>Severity</th><th>Impact</th><th>Est. Delay</th><th>Road Blocked</th><th>Trend</th></tr></thead>
                        <tbody>
                          {parkingData.top_hotspots.map(h => (
                            <tr key={h.cluster_id}>
                              <td>
                                <span 
                                  onClick={() => handleZoneClick(h.cluster_id)}
                                  style={{ color: 'var(--system-blue)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                                  title="View on Map"
                                >
                                  #{h.cluster_id}
                                </span>
                              </td>
                              <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.junction_label}</td>
                              <td>{h.top_police_station}</td>
                              <td><span style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>{h.location_type?.replace(/_/g, ' ')}</span></td>
                              <td>{h.violation_count}</td>
                              <td><ImpactBadge impact={h.parking_category} /></td>
                              <td><ImpactBadge impact={h.impact_category} /></td>
                              <td><strong>{h.estimated_delay_minutes?.toFixed(0)}</strong> min</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div style={{ flex: 1, height: '4px', borderRadius: '2px', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.min(h.carriageway_blockage_pct, 100)}%`, backgroundColor: IMPACT_COLORS[h.impact_category] || '#e67e22', borderRadius: '2px' }} />
                                  </div>
                                  <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h.carriageway_blockage_pct?.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td style={{ fontSize: '0.85rem' }}>{h.trend}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── TAB 3: CONGESTION IMPACT ────────────────────────────────── */}
          {activeTab === "Congestion Impact" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {!congestionData ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}><Activity size={32} className="animate-pulse" /><p>Loading congestion data...</p></div>
              ) : (
                <>
                  <section className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    {[
                      { label: 'Total Est. Delay', value: `${congestionData.total_delay_hours?.toLocaleString()} hrs`, sub: 'Cumulative vehicle-hours lost', color: 'var(--system-red)', icon: <Zap size={16} /> },
                      { label: 'Critical Blockage Zones', value: congestionData.critical_zones, sub: 'Delay > 500 min/period', color: 'var(--system-orange)', icon: <Flame size={16} /> },
                      { label: 'Junctions Affected', value: congestionData.unique_junctions?.toLocaleString(), sub: 'Named BTP junctions', color: 'var(--system-blue)', icon: <MapIcon size={16} /> },
                      { label: 'Peak Impact Hour', value: `${String(congestionData.peak_impact_hour).padStart(2, '0')}:00`, sub: 'For CRITICAL violations', color: 'var(--system-teal)', icon: <Clock size={16} /> },
                    ].map(m => (
                      <div key={m.label} className="card metric-card card-animate delay-1" style={{ borderLeft: `3px solid ${m.color}` }}>
                        <span className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{m.icon} {m.label}</span>
                        <span className="metric-value" style={{ color: m.color }}>{m.value}</span>
                        <span className="metric-subtext">{m.sub}</span>
                      </div>
                    ))}
                  </section>

                  <div className="dashboard-grid-main">
                    {/* Hour × Severity heatmap */}
                    <div className="card card-animate delay-2">
                      <div className="card-header"><h3 className="card-title">Hour × Violation Severity</h3></div>
                      <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={congestionData.heatmap_data} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="hour" tickFormatter={h => `${String(h).padStart(2,'0')}h`} stroke="var(--text-secondary)" style={{ fontSize: '0.65rem' }} interval={2} />
                            <YAxis stroke="var(--text-secondary)" style={{ fontSize: '0.7rem' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                            <Bar dataKey="CRITICAL" stackId="a" fill="#c0392b" />
                            <Bar dataKey="HIGH" stackId="a" fill="#e67e22" />
                            <Bar dataKey="MODERATE" stackId="a" fill="#f39c12" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Vehicle blockage */}
                    <div className="card card-animate delay-2">
                      <div className="card-header"><h3 className="card-title">Vehicle Type → Road Blockage %</h3></div>
                      <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={congestionData.vehicle_blockage} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                            <XAxis type="number" stroke="var(--text-secondary)" style={{ fontSize: '0.7rem' }} unit="%" domain={[0, 50]} />
                            <YAxis type="category" dataKey="vehicle" width={100} stroke="var(--text-secondary)" style={{ fontSize: '0.7rem' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} formatter={v => [`${v}%`, 'Avg Blockage']} />
                            <Bar dataKey="blockage_pct" radius={[0, 4, 4, 0]}>
                              {congestionData.vehicle_blockage.map((_, i) => (
                                <Cell key={i} fill={`hsl(${8 + i * 10}, 75%, ${60 - i * 4}%)`} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Weekly trend */}
                  <div className="card card-animate delay-3">
                    <div className="card-header"><h3 className="card-title"><TrendingUp size={16} style={{ color: 'var(--system-blue)' }} /> Week-over-Week City Violation Trend</h3></div>
                    <div style={{ height: '220px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={congestionData.weekly_trend} margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
                          <defs>
                            <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#c0392b" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#c0392b" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                          <XAxis dataKey="week" stroke="var(--text-secondary)" style={{ fontSize: '0.65rem' }} angle={-40} textAnchor="end" interval={1} />
                          <YAxis stroke="var(--text-secondary)" style={{ fontSize: '0.7rem' }} />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                          <Area type="monotone" dataKey="violations" stroke="#c0392b" strokeWidth={2} fill="url(#weekGrad)" dot={{ fill: '#c0392b', r: 3 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Junction risk table */}
                  <div className="card card-animate delay-4">
                    <div className="card-header"><h3 className="card-title">Junction Risk Ranking</h3></div>
                    <div className="table-wrapper">
                      <table>
                        <thead><tr><th>Junction ID</th><th>Junction Name</th><th>Police Station</th><th>Total Violations</th><th>Critical Violations</th></tr></thead>
                        <tbody>
                          {congestionData.junction_risks.map((j, i) => (
                            <tr key={i}>
                              <td><span style={{ color: 'var(--system-teal)', fontWeight: 600 }}>{j.junction_id || '—'}</span></td>
                              <td>{j.junction_label}</td>
                              <td>{j.police_station}</td>
                              <td>{j.violation_count.toLocaleString()}</td>
                              <td><span style={{ color: '#c0392b', fontWeight: 700 }}>{j.critical_count}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── TAB 4: PATROL PLANNER ──────────────────────────────────── */}
          {activeTab === "Patrol Planner" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {!patrolData ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}><Activity size={32} className="animate-pulse" /><p>Generating patrol schedule...</p></div>
              ) : (
                <>
                  {/* Summary KPIs */}
                  <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    {[
                      { label: 'Zones to Cover', value: patrolData.summary?.total_zones, sub: 'Total enforcement zones', color: 'var(--system-blue)' },
                      { label: 'Critical Zones', value: patrolData.summary?.critical_zones, sub: 'Immediate deployment needed', color: 'var(--system-red)' },
                      { label: 'Officers Recommended', value: patrolData.summary?.total_personnel, sub: 'Across all zones', color: 'var(--system-orange)' },
                      { label: 'Enforcement Gaps', value: patrolData.summary?.enforcement_gaps, sub: 'Zones under-patrolled', color: '#f39c12' },
                    ].map(m => (
                      <div key={m.label} className="card metric-card card-animate delay-1" style={{ borderLeft: `3px solid ${m.color}` }}>
                        <span className="metric-label">{m.label}</span>
                        <span className="metric-value" style={{ color: m.color }}>{m.value}</span>
                        <span className="metric-subtext">{m.sub}</span>
                      </div>
                    ))}
                  </section>

                  <div className="card card-animate delay-1" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Busiest Shift:</strong> {patrolData.summary?.top_shift} &nbsp;|&nbsp;
                      <strong style={{ color: 'var(--text-primary)' }}>Most Active Station:</strong> {patrolData.summary?.top_station}
                    </p>
                    {/* Shift filter */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filter Shift:</span>
                      <select className="select-control" value={patrolShiftFilter} onChange={e => setPatrolShiftFilter(e.target.value)}>
                        {['All Shifts', ...new Set(patrolData.schedule.map(s => s.peak_shift))].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Deployment schedule table */}
                  <div className="card card-animate delay-2">
                    <div className="card-header">
                      <h3 className="card-title"><Shield size={16} style={{ color: 'var(--system-blue)' }} /> Deployment Schedule</h3>
                      <span className="badge badge-red">{patrolData.schedule.filter(r => patrolShiftFilter === 'All Shifts' || r.peak_shift === patrolShiftFilter).length} zones</span>
                    </div>
                    <div className="table-wrapper">
                      <table>
                        <thead><tr><th>Pri.</th><th>Area / Junction</th><th>Station</th><th>Location</th><th>Shift</th><th>Peak Day</th><th>Impact</th><th>Est. Delay</th><th>Officers</th><th>Gap</th></tr></thead>
                        <tbody>
                          {patrolData.schedule
                            .filter(r => patrolShiftFilter === 'All Shifts' || r.peak_shift === patrolShiftFilter)
                            .map((r, i) => (
                              <tr key={i}>
                                <td><span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{r.priority}</span></td>
                                <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <span 
                                    onClick={() => handleZoneClick(r.cluster_id)} 
                                    style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--system-blue)' }}
                                    title="View on Map"
                                  >
                                    <strong>{r.area_name}</strong>
                                  </span>
                                </td>
                                <td>{r.police_station}</td>
                                <td style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>{r.location_type}</td>
                                <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{r.peak_shift}</td>
                                <td>{r.peak_day}</td>
                                <td><ImpactBadge impact={r.impact_category} /></td>
                                <td><strong>{r.estimated_delay_min?.toFixed(0)}</strong> min</td>
                                <td>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: r.personnel_needed >= 5 ? 'var(--system-red)' : 'var(--text-primary)' }}>
                                    <Users size={12} />{r.personnel_needed}
                                  </span>
                                </td>
                                <td>{r.enforcement_gap ? <span className="badge badge-red">GAP</span> : <span className="badge badge-green">OK</span>}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="btn-download" onClick={() => {
                        const data = patrolData.schedule.map(r => Object.values(r).join(',')).join('\n');
                        const headers = Object.keys(patrolData.schedule[0]).join(',');
                        const url = URL.createObjectURL(new Blob([headers + '\n' + data], { type: 'text/csv' }));
                        const a = document.createElement('a'); a.href = url; a.download = 'patrol_plan.csv'; a.click();
                      }}><Download size={16} />Download Patrol Plan (CSV)</button>
                    </div>
                  </div>

                  {/* Station workload bar chart */}
                  <div className="card card-animate delay-3">
                    <div className="card-header"><h3 className="card-title"><Users size={16} style={{ color: 'var(--system-orange)' }} /> Station-wise Officer Workload</h3></div>
                    <div style={{ height: '320px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical"
                          data={Object.entries(
                            patrolData.schedule.reduce((acc, r) => { acc[r.police_station] = (acc[r.police_station] || 0) + r.personnel_needed; return acc; }, {})
                          ).map(([k, v]) => ({ station: k, officers: v })).sort((a, b) => b.officers - a.officers).slice(0, 18)}
                          margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                          <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                          <XAxis type="number" stroke="var(--text-secondary)" style={{ fontSize: '0.7rem' }} />
                          <YAxis type="category" dataKey="station" width={130} stroke="var(--text-secondary)" style={{ fontSize: '0.68rem' }} />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                          <Bar dataKey="officers" radius={[0, 4, 4, 0]}>
                            {Array.from({ length: 18 }).map((_, i) => <Cell key={i} fill={`hsl(${8 + i * 8}, 70%, ${60 - i * 2}%)`} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── TAB 5: RISK SCORING ─────────────────────────────────────── */}
          {activeTab === "Risk Scoring" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="dashboard-grid-main">
                <div className="card card-animate delay-2">
                  <div className="card-header"><h3 className="card-title"><BarChart2 size={16} style={{ color: 'var(--system-blue)' }} /> Top 15 Hotspots — Est. Delay</h3></div>
                  <div className="chart-container-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hotspots.slice(0, 15)}>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="cluster_id" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} tickFormatter={v => `Z${v}`} />
                        <YAxis stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                          formatter={(value, name) => [`${value?.toFixed(0)} min`, 'Est. Delay']} />
                        <Bar dataKey="estimated_delay_minutes" radius={[4, 4, 0, 0]}>
                          {hotspots.slice(0, 15).map((entry, i) => <Cell key={i} fill={IMPACT_COLORS[entry.impact_category] || '#3498db'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card card-animate delay-2">
                  <div className="card-header"><h3 className="card-title"><Info size={16} style={{ color: 'var(--system-orange)' }} /> Cases vs Approval Rate</h3></div>
                  <div className="chart-container-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                        <XAxis type="number" dataKey="violation_count" name="Total Cases" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                        <YAxis type="number" dataKey="approval_rate" name="Approval Rate" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                        <ZAxis type="number" dataKey="congestion_score" range={[60, 400]} name="Risk Score" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} formatter={(value, name) => name === "Approval Rate" ? [`${(value * 100).toFixed(0)}%`, name] : [value, name]} />
                        <Scatter name="Zones" data={hotspots} fill="var(--system-blue)">
                          {hotspots.map((entry, i) => <Cell key={i} fill={entry.enforcement_gap_flag ? 'var(--system-red)' : 'var(--system-green)'} />)}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="card card-animate delay-3">
                <div className="card-header"><h3 className="card-title">Zone Prioritization & Scoring Ledger</h3></div>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Zone</th><th>Impact</th><th>Severity</th><th>Est. Delay</th><th>Road Block</th><th>Cases</th><th>Approval</th><th>Gap</th><th>Offence</th><th>Peak</th><th>Trend</th><th>Station</th></tr></thead>
                    <tbody>
                      {hotspots.map(h => (
                        <tr key={h.cluster_id}>
                          <td>
                            <span 
                              onClick={() => handleZoneClick(h.cluster_id)}
                              style={{ color: 'var(--system-blue)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                              title="View on Map"
                            >
                              #{h.cluster_id}
                            </span>
                          </td>
                          <td><ImpactBadge impact={h.impact_category} /></td>
                          <td><ImpactBadge impact={h.parking_category} /></td>
                          <td><strong>{h.estimated_delay_minutes?.toFixed(0)}</strong> min</td>
                          <td>{h.carriageway_blockage_pct?.toFixed(1)}%</td>
                          <td>{h.violation_count}</td>
                          <td>{(h.approval_rate * 100).toFixed(0)}%</td>
                          <td>{h.enforcement_gap_flag ? <span className="badge badge-red">GAP</span> : <span className="badge badge-green">OK</span>}</td>
                          <td style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.top_violation}</td>
                          <td>{h.peak_hour}:00</td>
                          <td style={{ fontSize: '0.8rem' }}>{h.trend}</td>
                          <td>{h.top_police_station}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 6: SHIFT DEPLOYMENT ─────────────────────────────────── */}
          {activeTab === "Shift Deployment" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card card-animate delay-1">
                <h3 className="card-title" style={{ marginBottom: '0.5rem' }}><Clock size={16} style={{ color: 'var(--system-blue)' }} /> Shift Patrol Recommendations</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Operational shifting windows aligned to peak violation times. Officers should prioritize red-tagged zones during their shift.</p>
              </div>
              <div className="shifts-grid">
                {Object.entries(shifts).map(([shiftName, data], idx) => (
                  <div key={shiftName} className={`card shift-card card-animate delay-${Math.min(4, idx + 2)}`}>
                    <div className="shift-header">
                      <span className="shift-name">{shiftName} Shift</span>
                      <span className="shift-time">{data.hours}</span>
                    </div>
                    <div className="shift-meta">
                      <div className="shift-meta-item" style={{ flex: '1.5' }}>
                        <span className="shift-meta-label">Primary Offence</span>
                        <span className="shift-meta-value" style={{ fontSize: '0.95rem' }}>{data.top_violation}</span>
                      </div>
                      <div className="shift-meta-item" style={{ flex: '1' }}>
                        <span className="shift-meta-label">Total Cases</span>
                        <span className="shift-meta-value" style={{ color: 'var(--system-blue)' }}>{data.total}</span>
                      </div>
                      <div className="shift-meta-item" style={{ flex: '1', textAlign: 'right' }}>
                        <span className="shift-meta-label">Alert Level</span>
                        <span className="shift-meta-value" style={{ color: data.has_gap_zone ? 'var(--system-red)' : 'var(--system-green)' }}>
                          {data.has_gap_zone ? "High" : "Normal"}
                        </span>
                      </div>
                    </div>
                    <div className="shift-hotspots-section">
                      <span className="shift-meta-label" style={{ marginBottom: '0.25rem', display: 'block' }}>Top Active Hotspots</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {data.top_hotspots.map(th => (
                          <div key={th.cluster_id} className="shift-hotspot-item">
                            <div className="shift-hotspot-info">
                              <span 
                                className="shift-hotspot-title"
                                onClick={() => handleZoneClick(th.cluster_id)}
                                style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--system-blue)' }}
                                title="View on Map"
                              >
                                Zone #{th.cluster_id}
                              </span>
                              <span className="shift-hotspot-station">{th.police_station} precinct</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="shift-hotspot-metric">{th.count} cases</span>
                              <ImpactBadge impact={th.impact} />
                              {th.is_gap && <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>GAP</span>}
                            </div>
                          </div>
                        ))}
                        {data.top_hotspots.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No active hotspots during this window.</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TAB 7: STATION ANALYSIS ─────────────────────────────────── */}
          {activeTab === "Station Analysis" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card card-animate delay-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 className="card-title">Police Station Precinct Ledger</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Filter enforcement efficiency and vehicle distributions by jurisdiction.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Select Station:</span>
                  <select className="select-control" value={selectedStation} onChange={e => setSelectedStation(e.target.value)}>
                    {stations.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>
              {stationData && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem' }} className="station-overview-container">
                    <div className="card card-animate delay-2" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div className="card-header" style={{ marginBottom: '0.5rem' }}><h3 className="card-title"><Activity size={16} style={{ color: 'var(--system-teal)' }} /> Precinct Efficiency Rings</h3></div>
                      <PrecinctActivityRings approvalRate={stationData.approval_rate} resolutionCompliance={Math.max(0.1, Math.min(0.95, 24 / Math.max(1, stationData.avg_resolution_hours || 24)))} activityRate={Math.max(0.1, Math.min(0.99, 1 - (stationData.gaps_count / Math.max(1, stationData.hotspots_count || 1))))} />
                    </div>
                    <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                      {[
                        { label: 'Jurisdiction Cases', value: stationData.total_cases?.toLocaleString(), sub: 'Total recorded in precinct' },
                        { label: 'Avg Approval Rate', value: `${(stationData.approval_rate * 100).toFixed(1)}%`, sub: 'Target: >60%', color: stationData.approval_rate < 0.6 ? 'var(--system-red)' : 'var(--system-green)' },
                        { label: 'Avg Resolution Time', value: stationData.avg_resolution_hours ? `${stationData.avg_resolution_hours.toFixed(1)} hrs` : 'N/A', sub: 'Target: <24 hrs' },
                        { label: 'Active Gaps / Hotspots', value: `${stationData.gaps_count} / ${stationData.hotspots_count}`, sub: 'Requires dispatch' },
                      ].map(m => (
                        <div key={m.label} className="card metric-card card-animate delay-2">
                          <span className="metric-label">{m.label}</span>
                          <span className="metric-value" style={{ fontSize: '1.8rem', color: m.color }}>{m.value}</span>
                          <span className="metric-subtext">{m.sub}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="station-grid">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div className="card card-animate delay-3">
                        <div className="card-header"><h3 className="card-title">Monthly Activity Trend</h3></div>
                        <div className="chart-container-wrapper">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={Object.entries(stationData.monthly_trend).map(([m, c]) => ({ month: ["", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"][parseInt(m)] || m, cases: c }))}>
                              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                              <XAxis dataKey="month" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                              <YAxis stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                              <Bar dataKey="cases" fill="var(--system-blue)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="card card-animate delay-3">
                        <div className="card-header"><h3 className="card-title">Vehicle Mix Breakdown</h3></div>
                        <div style={{ display: 'flex', alignItems: 'center', height: '240px' }}>
                          <div style={{ height: '200px', width: '60%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={Object.entries(stationData.vehicle_mix).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                                  {Object.keys(stationData.vehicle_mix).map((k, i) => <Cell key={k} fill={SEVERITY_PALETTE[i % SEVERITY_PALETTE.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div style={{ width: '40%', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            {Object.entries(stationData.vehicle_mix).map(([k, v], i) => (
                              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: SEVERITY_PALETTE[i % SEVERITY_PALETTE.length] }}></span>
                                <span style={{ color: 'var(--text-secondary)' }}>{k}: <strong style={{ color: 'var(--text-primary)' }}>{v}</strong></span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div className="card card-animate delay-4">
                        <div className="card-header"><h3 className="card-title">Top Infraction Offences</h3></div>
                        <div className="station-list-container">
                          {stationData.top_violations.map((tv, idx) => (
                            <div key={idx} className="station-list-item">
                              <span className="station-list-item-label"><span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getViolationColor(tv.violation), display: 'inline-block' }}></span>{tv.violation}</span>
                              <span className="station-list-item-value">{tv.count} cases</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="card card-animate delay-4">
                        <div className="card-header"><h3 className="card-title">Key Congested Junctions</h3></div>
                        <div className="station-list-container">
                          {stationData.top_junctions.map((tj, idx) => (
                            <div key={idx} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{tj.junction}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Location spot {idx + 1}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tj.count}</span>
                                <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── TAB 8: MAPMYINDIA VIEW ──────────────────────────────────── */}
          {activeTab === "MapmyIndia View" && (
            <div className="card" style={{ height: '600px', padding: '0.5rem' }}>
              <iframe
                src={`${API_BASE}/mapmyindia/html`}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px', backgroundColor: '#07090e' }}
                title="MapmyIndia Dashboard View"
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
